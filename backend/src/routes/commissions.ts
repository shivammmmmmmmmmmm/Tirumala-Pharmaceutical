import { Router, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatCommission, formatOrder } from '../utils/formatters.js'
import { createCommissionForOrder } from '../utils/commission.js'
import { createNotification } from '../utils/notifications.js'

const router: Router = Router()

router.get('/', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { status, spId, customerId, from, to } = req.query as Record<string, string>
    const conds: string[] = []
    const params: unknown[] = []
    if (role === 'SALES_PERSON') {
      conds.push('c.sp_id = ?')
      params.push(userId)
    }
    if (role === 'ADMIN' && spId) {
      conds.push('c.sp_id = ?')
      params.push(spId)
    }
    if (status) {
      conds.push('c.status = ?')
      params.push(status)
    }
    if (customerId) {
      conds.push('o.user_id = ?')
      params.push(customerId)
    }
    if (from) {
      conds.push('date(c.created_at) >= date(?)')
      params.push(from)
    }
    if (to) {
      conds.push('date(c.created_at) <= date(?)')
      params.push(to)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const rows = await query<RowDataPacket>(
      `SELECT c.*, o.order_number, o.user_id as customer_id, u.name as sp_name,
              cu.name as customer_name, cu.organization_name as customer_org
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       LEFT JOIN users cu ON o.user_id = cu.id
       ${where} ORDER BY c.created_at DESC`,
      params
    )
    return res.json({ success: true, data: rows.map(formatCommission) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/report', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { status, from, to, customerId } = req.query as Record<string, string>
    const conds: string[] = []
    const params: unknown[] = []

    if (role === 'SALES_PERSON') {
      conds.push('c.sp_id = ?')
      params.push(userId)
    }
    if (status) {
      conds.push('c.status = ?')
      params.push(status)
    }
    if (customerId) {
      conds.push('o.user_id = ?')
      params.push(customerId)
    }
    if (from) {
      conds.push('date(c.created_at) >= date(?)')
      params.push(from)
    }
    if (to) {
      conds.push('date(c.created_at) <= date(?)')
      params.push(to)
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const summary = await query<RowDataPacket>(
      `SELECT c.sp_id, u.name as sp_name, o.user_id as customer_id, cu.name as customer_name, cu.organization_name as customer_org,
              COUNT(*) as total_count,
              COALESCE(SUM(c.commission_amount), 0) as total_amount,
              COALESCE(SUM(CASE WHEN c.status = 'PAID' THEN c.commission_amount ELSE 0 END), 0) as paid_amount,
              COALESCE(SUM(CASE WHEN c.status != 'PAID' THEN c.commission_amount ELSE 0 END), 0) as unpaid_amount
       FROM commissions c
       LEFT JOIN users u ON c.sp_id = u.id
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users cu ON o.user_id = cu.id
       ${where}
       GROUP BY c.sp_id, u.name, o.user_id, cu.name, cu.organization_name
       ORDER BY total_amount DESC`,
      params
    )
    return res.json({
      success: true,
      data: summary.map(s => ({
        spId: s.sp_id,
        spName: s.sp_name,
        customerId: s.customer_id,
        customerName: s.customer_name,
        customerOrg: s.customer_org,
        totalCount: Number(s.total_count || 0),
        totalAmount: Number(s.total_amount || 0),
        paidAmount: Number(s.paid_amount || 0),
        unpaidAmount: Number(s.unpaid_amount || 0),
      })),
    })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/pending-orders', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, sp.name as sp_name, sp.sp_commission_pct as sp_default_pct
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN users sp ON o.sp_id = sp.id
       LEFT JOIN commissions c ON c.order_id = o.id
       WHERE ((o.receipt_status = 'CONFIRMED') OR (o.customer_delivery_status = 'CONFIRMED' AND o.delivery_screenshot_url IS NOT NULL))
         AND c.id IS NULL AND o.sp_id IS NOT NULL
       ORDER BY COALESCE(o.receipt_confirmed_at, o.updated_at) DESC`
    )
    const items = await Promise.all(
      rows.map(async o => {
        const orderItems = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [o.id])
        return {
          ...formatOrder(o, orderItems),
          spName: o.sp_name,
          spDefaultPct: Number(o.sp_default_pct || 0),
        }
      })
    )
    return res.json({ success: true, data: items })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/from-order', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, commissionPct } = req.body
    if (!orderId || commissionPct === undefined) {
      return res.status(400).json({ success: false, error: 'orderId and commissionPct required' })
    }
    const result = await createCommissionForOrder(orderId, Number(commissionPct), req.user!.userId)
    if (!result) return res.status(400).json({ success: false, error: 'Could not create commission' })
    const c = await queryOne<RowDataPacket>('SELECT * FROM commissions WHERE id=?', [result.id])
    await run(
      'UPDATE notifications SET is_read=1 WHERE order_id=? AND action_type=?',
      [orderId, 'SET_COMMISSION']
    )
    return res.status(201).json({ success: true, data: formatCommission(c!) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return res.status(400).json({ success: false, error: msg })
  }
})

// 💰 COMMISSION VERIFICATION - Admin verify payment proof before approving commission
router.get('/:id/verify', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const commission = await queryOne<RowDataPacket>(
      `SELECT c.*, o.order_number, o.payment_screenshot_url, o.delivery_screenshot_url, o.payment_status, o.payment_method,
              o.paid_amount, o.total_amount, u.name as sp_name, cu.name as customer_name
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       LEFT JOIN users cu ON o.user_id = cu.id
       WHERE c.id=?`,
      [req.params.id]
    )
    if (!commission) return res.status(404).json({ success: false, error: 'Commission not found' })

    return res.json({
      success: true,
      data: {
        commissionId: commission.id,
        orderId: commission.order_id,
        orderNumber: commission.order_number,
        spName: commission.sp_name,
        customerName: commission.customer_name,
        commissionAmount: Number(commission.commission_amount),
        commissionPct: Number(commission.commission_pct),
        deliveryProof: {
          screenshot: commission.delivery_screenshot_url,
        },
        paymentProof: {
          screenshot: commission.payment_screenshot_url,
          paymentMethod: commission.payment_method,
          paymentStatus: commission.payment_status,
          paidAmount: Number(commission.paid_amount),
          totalAmount: Number(commission.total_amount),
          isFullyPaid: Number(commission.paid_amount) >= Number(commission.total_amount),
        },
        status: commission.status,
      },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 📋 COMMISSION VERIFICATION LIST - Get all commissions awaiting verification
router.get('/admin/awaiting-verification', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT c.*, o.order_number, o.payment_screenshot_url, o.receipt_status,
              u.name as sp_name, cu.name as customer_name, cu.organization_name as customer_org
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       LEFT JOIN users cu ON o.user_id = cu.id
       WHERE c.status = 'PENDING' AND o.receipt_status = 'CONFIRMED'
       ORDER BY c.created_at DESC`
    )
    return res.json({
      success: true,
      data: rows.map(c => ({
        commissionId: c.id,
        orderId: c.order_id,
        orderNumber: c.order_number,
        spName: c.sp_name,
        customerName: c.customer_name,
        customerOrg: c.customer_org,
        amount: Number(c.commission_amount),
        pct: Number(c.commission_pct),
        hasPaymentProof: !!c.payment_screenshot_url,
        receiptStatus: c.receipt_status,
        createdAt: c.created_at,
      })),
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 🆕 RELEASE COMMISSION - Admin releases commission after user confirms receipt
router.post('/:id/release', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const commission = await queryOne<RowDataPacket>('SELECT * FROM commissions WHERE id=?', [req.params.id])
    if (!commission) return res.status(404).json({ success: false, error: 'Commission not found' })
    if (commission.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Commission is not in PENDING status' })
    }

    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await run(
      "UPDATE commissions SET status='PAID', paid_at=?, updated_at=? WHERE id=?",
      [ts, ts, req.params.id]
    )

    // Notify sales person that commission is released
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [commission.order_id])
    const sp = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [commission.sp_id])
    const admin = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [req.user!.userId])

    if (order && commission.sp_id) {
      await createNotification({
        userId: String(commission.sp_id),
        type: 'COMMISSION_RELEASED',
        title: 'Commission released',
        body: `Admin released your commission of ₹${Number(commission.commission_amount).toFixed(2)} for order ${order.order_number}.`,
        orderId: String(commission.order_id),
        metadata: { orderNumber: order.order_number, amount: commission.commission_amount },
      })
    }

    // Mark order as COMPLETED
    if (order) {
      await run('UPDATE orders SET status=?, updated_at=? WHERE id=?', ['COMPLETED', ts, commission.order_id])
    }

    await run(
      'UPDATE notifications SET is_read=1 WHERE order_id=? AND action_type=?',
      [commission.order_id, 'RELEASE_COMMISSION']
    )

    const updated = await queryOne<RowDataPacket>(
      `SELECT c.*, o.order_number, u.name as sp_name
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       WHERE c.id=?`,
      [req.params.id]
    )

    return res.json({
      success: true,
      data: formatCommission(updated!),
      message: 'Commission released and order completed',
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 🆕 READY FOR RELEASE - Get orders where customer confirmed receipt and commission is pending
router.get('/admin/ready-for-release', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT c.*, o.order_number, o.receipt_confirmed_at, o.delivery_screenshot_url, o.payment_screenshot_url,
              u.name as sp_name, cu.name as customer_name, cu.organization_name as customer_org
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       LEFT JOIN users cu ON o.user_id = cu.id
       WHERE c.status = 'PENDING' AND o.receipt_status = 'CONFIRMED'
       ORDER BY o.receipt_confirmed_at DESC`
    )
    return res.json({
      success: true,
      data: rows.map(c => ({
        commissionId: c.id,
        orderId: c.order_id,
        orderNumber: c.order_number,
        spName: c.sp_name,
        customerName: c.customer_name,
        customerOrg: c.customer_org,
        amount: Number(c.commission_amount),
        pct: Number(c.commission_pct),
        deliveryScreenshotUrl: c.delivery_screenshot_url,
        paymentScreenshotUrl: c.payment_screenshot_url,
        receiptConfirmedAt: c.receipt_confirmed_at,
        createdAt: c.created_at,
      })),
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ✅ APPROVE COMMISSION - Admin approves commission after verification
router.post('/:id/approve', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const commission = await queryOne<RowDataPacket>('SELECT * FROM commissions WHERE id=?', [req.params.id])
    if (!commission) return res.status(404).json({ success: false, error: 'Commission not found' })
    if (commission.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Commission is not in PENDING status' })
    }

    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await run('UPDATE commissions SET status=?, updated_at=? WHERE id=?', ['APPROVED', ts, req.params.id])

    // Notify sales person that commission is approved
    await query<RowDataPacket>(
      `SELECT c.id FROM commissions c WHERE c.id=?`,
      [req.params.id]
    )

    const updated = await queryOne<RowDataPacket>(
      `SELECT c.*, o.order_number, u.name as sp_name
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       WHERE c.id=?`,
      [req.params.id]
    )

    return res.json({
      success: true,
      data: formatCommission(updated!),
      message: 'Commission approved',
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.patch('/:id/pay', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await run("UPDATE commissions SET status='PAID', paid_at=?, updated_at=? WHERE id=?", [ts, ts, req.params.id])
    return res.json({ success: true, message: 'Commission marked as paid' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
