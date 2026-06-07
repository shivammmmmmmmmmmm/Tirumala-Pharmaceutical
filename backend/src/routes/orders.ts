import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatOrder } from '../utils/formatters.js'
import { resolveUnitPrice } from '../utils/pricing.js'
import { logAudit } from '../utils/audit.js'
import { saveBase64Upload } from '../utils/save-upload.js'
import { createNotification, notifyUsers } from '../utils/notifications.js'
import { calculateCommission } from '../utils/commission.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function canAccessOrder(role: string, userId: string, order: RowDataPacket): Promise<boolean> {
  if (role === 'ADMIN') return true
  if (role === 'USER') return order.user_id === userId
  if (role === 'SALES_PERSON') return order.sp_id === userId
  return false
}

// ── LIST ORDERS ───────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20)
    const status = req.query.status as string
    const offset = (page - 1) * pageSize

    const conds: string[] = []
    const params: unknown[] = []

    if (role === 'USER') {
      conds.push('o.user_id = ?')
      params.push(userId)
    } else if (role === 'SALES_PERSON') {
      conds.push('o.sp_id = ?')
      params.push(userId)
    }
    if (status) {
      conds.push('o.status = ?')
      params.push(status)
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const totalRow = await queryOne<RowDataPacket>(`SELECT COUNT(*) as c FROM orders o ${where}`, params)
    const total = Number(totalRow?.c ?? 0)
    const orders = await query<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, sp.name as sp_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN users sp ON o.sp_id = sp.id
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    return res.json({
      success: true,
      data: { data: orders.map(o => formatOrder(o)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── GET SINGLE ORDER ──────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const o = await queryOne<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, sp.name as sp_name
       FROM orders o LEFT JOIN users u ON o.user_id=u.id LEFT JOIN users sp ON o.sp_id=sp.id
       WHERE o.id = ?`,
      [req.params.id]
    )
    if (!o) return res.status(404).json({ success: false, error: 'Order not found' })
    if (!(await canAccessOrder(role, userId, o))) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id = ?', [req.params.id])
    return res.json({ success: true, data: formatOrder(o, items) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── CREATE ORDER (Sales person places for user) ──────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    const { items, paymentMethod, shippingAddress, notes, targetUserId } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must have at least one item' })
    }

    let orderUserId = userId
    if (role === 'SALES_PERSON' && targetUserId) {
      const customer = await queryOne<RowDataPacket>(
        'SELECT * FROM users WHERE id = ? AND role = ? AND assigned_sp_id = ?',
        [targetUserId, 'USER', userId]
      )
      if (!customer) {
        return res.status(403).json({ success: false, error: 'Customer not assigned to you' })
      }
      orderUserId = targetUserId
    } else if (role !== 'USER') {
      return res.status(403).json({ success: false, error: 'Only customers can place orders directly' })
    }

    const user = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [orderUserId])
    if (!user) return res.status(404).json({ success: false, error: 'User not found' })
    if (user.is_blocked) {
      return res.status(403).json({ success: false, error: 'Customer account is blocked' })
    }

    const spRow = await queryOne<RowDataPacket>('SELECT assigned_sp_id FROM users WHERE id=?', [orderUserId])
    const spId = role === 'SALES_PERSON' ? userId : spRow?.assigned_sp_id || null

    let subtotal = 0
    let discountAmount = 0
    const resolvedItems: { product: RowDataPacket; quantity: number; unitPrice: number; discountPct: number; totalPrice: number }[] = []

    for (const item of items) {
      const product = await queryOne<RowDataPacket>(
        'SELECT * FROM products WHERE id=? AND is_active=1',
        [item.productId]
      )
      if (!product) return res.status(400).json({ success: false, error: `Product ${item.productId} not found` })
      if (product.quantity < item.quantity) {
        return res.status(400).json({ success: false, error: `Insufficient stock for ${product.name}` })
      }
      const unitPrice = await resolveUnitPrice(product, String(user.role), item.quantity)
      const disc = Number(product.discount_pct) || 0
      const lineTotal = unitPrice * item.quantity * (1 - disc / 100)
      subtotal += unitPrice * item.quantity
      discountAmount += unitPrice * item.quantity * (disc / 100)
      resolvedItems.push({ product, quantity: item.quantity, unitPrice, discountPct: disc, totalPrice: lineTotal })
    }

    const taxableAmount = subtotal - discountAmount
    const gstPct = 12
    const gstAmount = Math.round(taxableAmount * gstPct) / 100
    const totalAmount = taxableAmount + gstAmount
    const pm = paymentMethod || 'CREDIT'

    if (pm === 'CREDIT') {
      const available = Number(user.credit_limit || 0) - Number(user.credit_used || 0)
      if (totalAmount > available) {
        return res.status(400).json({
          success: false,
          error: `Insufficient credit. Available: ₹${available.toFixed(2)}`,
        })
      }
    }

    const orderId = uuidv4()
    const orderNumber = `ORD-${Date.now()}`
    const ts = now()

    await run(
      `INSERT INTO orders (id,order_number,user_id,sp_id,status,payment_method,payment_status,
       subtotal,discount_amount,total_amount,gst_amount,paid_amount,notes,shipping_address,created_at,updated_at)
       VALUES (?,?,?,?,'PENDING',?,?,?,?,?,?,0,?,?,?,?)`,
      [
        orderId, orderNumber, orderUserId, spId, pm, pm === 'CREDIT' ? 'PENDING' : 'PAID',
        subtotal, discountAmount, totalAmount, gstAmount, notes || null, shippingAddress || null, ts, ts,
      ]
    )

    await run('DELETE FROM cart_items WHERE user_id=?', [orderUserId])

    for (const ri of resolvedItems) {
      await run(
        `INSERT INTO order_items (id,order_id,product_id,product_name,quantity,unit_price,discount_pct,total_price)
         VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), orderId, ri.product.id, ri.product.name, ri.quantity, ri.unitPrice, ri.discountPct, ri.totalPrice]
      )
      await run('UPDATE products SET quantity = quantity - ?, updated_at=? WHERE id=?', [
        ri.quantity, ts, ri.product.id,
      ])
    }

    if (pm === 'CREDIT') {
      await run('UPDATE users SET credit_used = credit_used + ?, updated_at=? WHERE id=?', [
        totalAmount, ts, orderUserId,
      ])
      const newBalance = Number(user.credit_used || 0) + totalAmount
      await run(
        `INSERT INTO ledger (id,user_id,type,amount,balance_after,description,reference_id,reference_type,created_at)
         VALUES (?,?,'DEBIT',?,?,?,?,'ORDER',?)`,
        [uuidv4(), orderUserId, totalAmount, newBalance, `Order ${orderNumber}`, orderId, ts]
      )
    }

    // Commission is created only after delivery confirmed by user (see confirm-receipt)

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [orderId])
    const items2 = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [orderId])

    // Notify all admins about the new order
    try {
      const admins = await query<RowDataPacket>("SELECT id FROM users WHERE role='ADMIN' AND is_active=1")
      const placedBy = role === 'SALES_PERSON'
        ? await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [userId])
        : user
      const placerLabel = role === 'SALES_PERSON'
        ? `SP: ${placedBy?.name || 'Sales Person'}`
        : (user.organization_name || user.name)
      await notifyUsers(
        admins.map(a => String(a.id)),
        {
          type: 'NEW_ORDER',
          title: 'New order received',
          body: `${orderNumber} placed by ${placerLabel} · ₹${totalAmount.toFixed(2)} · ${pm}`,
          orderId,
          requiresAction: true,
          actionType: 'VERIFY_PAYMENT',
          metadata: { orderNumber, paymentMethod: pm, totalAmount, placedBy: placerLabel },
        }
      )
    } catch (notifErr) {
      console.error('Failed to send new order notification:', notifErr)
    }

    return res.status(201).json({ success: true, data: formatOrder(order!, items2) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── UPDATE ORDER STATUS ──────────────────────────────────────────────────────
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['ADMIN', 'SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const { status } = req.body
    const valid = ['PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' })

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const ts = now()
    await run('UPDATE orders SET status=?, updated_at=? WHERE id=?', [status, ts, req.params.id])

    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      const orderItems = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
      for (const item of orderItems) {
        await run('UPDATE products SET quantity=quantity+?, updated_at=? WHERE id=?', [
          item.quantity, ts, item.product_id,
        ])
      }
      if (order.payment_method === 'CREDIT') {
        await run('UPDATE users SET credit_used=credit_used-?, updated_at=? WHERE id=?', [
          order.total_amount, ts, order.user_id,
        ])
        const u = await queryOne<RowDataPacket>('SELECT credit_used FROM users WHERE id=?', [order.user_id])
        await run(
          `INSERT INTO ledger (id,user_id,type,amount,balance_after,description,reference_id,reference_type,created_at)
           VALUES (?,?,'CREDIT',?,?,?,?,'ORDER_CANCEL',?)`,
          [
            uuidv4(), order.user_id, order.total_amount, u?.credit_used || 0,
            `Cancelled: ${order.order_number}`, req.params.id, ts,
          ]
        )
      }
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'ORDER_STATUS',
      entityType: 'order',
      entityId: req.params.id,
      details: status,
    })

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── UPDATE DELIVERY (tracking) ───────────────────────────────────────────────
router.patch('/:id/delivery', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['ADMIN', 'SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const { trackingCode, deliveryNotes, status } = req.body
    const ts = now()
    const newStatus = status || order.status
    await run(
      'UPDATE orders SET tracking_code=COALESCE(?,tracking_code), delivery_notes=COALESCE(?,delivery_notes), status=COALESCE(?,status), updated_at=? WHERE id=?',
      [trackingCode ?? null, deliveryNotes ?? null, status ?? null, ts, req.params.id]
    )
    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── UPLOAD PAYMENT PROOF ─────────────────────────────────────────────────────
router.post('/:id/payment-proof', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { screenshotDataUrl, fileName, paymentMethod } = req.body
    if (!screenshotDataUrl) {
      return res.status(400).json({ success: false, error: 'Payment screenshot is required' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'USER' && order.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const url = await saveBase64Upload(order.user_id, 'payment', screenshotDataUrl, fileName || 'payment.jpg')
    if (!url) return res.status(400).json({ success: false, error: 'Failed to save screenshot' })
    const ts = now()
    await run('UPDATE orders SET payment_screenshot_url=?, updated_at=? WHERE id=?', [url, ts, req.params.id])
    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── RECORD PAYMENT (partial/full) ────────────────────────────────────────────
router.post('/:id/payment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['ADMIN', 'SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const { amount } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Valid amount required' })

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const newPaid = Number(order.paid_amount || 0) + amount
    const payStatus = newPaid >= Number(order.total_amount) ? 'PAID' : 'PARTIAL'
    const ts = now()
    await run('UPDATE orders SET paid_amount=?, payment_status=?, updated_at=? WHERE id=?', [
      newPaid, payStatus, ts, order.id,
    ])

    if (order.payment_method === 'CREDIT') {
      await run('UPDATE users SET credit_used=credit_used-?, updated_at=? WHERE id=?', [amount, ts, order.user_id])
      const u = await queryOne<RowDataPacket>('SELECT credit_used FROM users WHERE id=?', [order.user_id])
      await run(
        `INSERT INTO ledger (id,user_id,type,amount,balance_after,description,reference_id,reference_type,created_at)
         VALUES (?,?,'CREDIT',?,?,?,?,'PAYMENT',?)`,
        [uuidv4(), order.user_id, amount, u?.credit_used || 0, `Payment for ${order.order_number}`, order.id, ts]
      )
    }

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [order.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [order.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 🆕 ── ADMIN: VERIFY PAYMENT ─────────────────────────────────────────────────
// Admin checks payment (COD mention / online proof / cheque screenshot) and confirms
router.post('/:id/verify-payment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only admins can verify payment' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Order must be in PENDING status to verify payment' })
    }

    const ts = now()
    await run(
      'UPDATE orders SET status=?, payment_status=?, payment_verified_at=?, payment_verified_by=?, updated_at=? WHERE id=?',
      ['APPROVED', 'PAID', ts, userId, ts, req.params.id]
    )

    // If CREDIT, update credit_used
    if (order.payment_method === 'CREDIT') {
      await run('UPDATE users SET credit_used=credit_used+?, updated_at=? WHERE id=?', [
        order.total_amount, ts, order.user_id,
      ])
    }

    // Notify sales person that order is approved and ready for dispatch
    if (order.sp_id) {
      const admin = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [userId])
      await createNotification({
        userId: String(order.sp_id),
        type: 'PAYMENT_VERIFIED',
        title: 'Payment verified — Ready to dispatch',
        body: `Order ${order.order_number} payment verified by admin. Please collect and dispatch the material.`,
        orderId: String(order.id),
        requiresAction: true,
        actionType: 'REQUEST_DISPATCH',
        metadata: { orderNumber: order.order_number, verifiedBy: admin?.name },
      })
    }

    await logAudit({
      userId,
      action: 'PAYMENT_VERIFIED',
      entityType: 'order',
      entityId: req.params.id,
      details: 'Payment verified, order approved for dispatch',
    })

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Payment verified. Order is now approved.' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 🆕 ── ADMIN: REQUEST DISPATCH TO SP ─────────────────────────────────────────
// Admin asks SP to collect and dispatch material
router.post('/:id/request-dispatch', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only admins can request dispatch' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.status !== 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Order must be APPROVED before dispatch request' })
    }
    if (!order.sp_id) {
      return res.status(400).json({ success: false, error: 'No sales person assigned to this order' })
    }

    const ts = now()
    await run(
      'UPDATE orders SET status=?, dispatch_requested_at=?, updated_at=? WHERE id=?',
      ['DISPATCHED', ts, ts, req.params.id]
    )

    // Notify sales person to collect and dispatch
    const admin = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [userId])
    await createNotification({
      userId: String(order.sp_id),
      type: 'DISPATCH_REQUEST',
      title: 'Collect and dispatch material',
      body: `Admin requested dispatch for order ${order.order_number}. Please collect the material and send courier details.`,
      orderId: String(order.id),
      requiresAction: true,
      actionType: 'SUBMIT_TRACKING',
      metadata: { orderNumber: order.order_number, requestedBy: admin?.name },
    })

    await logAudit({
      userId,
      action: 'DISPATCH_REQUESTED',
      entityType: 'order',
      entityId: req.params.id,
      details: 'Dispatch requested to sales person',
    })

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Dispatch requested to sales person.' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 🆕 ── SP: SUBMIT TRACKING / COURIER DETAILS ─────────────────────────────────
// Sales person submits courier/tracking details after packing
router.post('/:id/submit-tracking', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'SALES_PERSON') {
      return res.status(403).json({ success: false, error: 'Only sales persons can submit tracking' })
    }
    const { trackingCode, deliveryNotes, courierScreenshot } = req.body
    if (!trackingCode && !courierScreenshot) {
      return res.status(400).json({ success: false, error: 'Tracking code or courier screenshot is required' })
    }

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.sp_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })
    if (order.status !== 'DISPATCHED') {
      return res.status(400).json({ success: false, error: 'Order must be DISPATCHED status' })
    }

    const ts = now()
    let screenshotUrl = order.delivery_screenshot_url

    if (courierScreenshot) {
      const saved = await saveBase64Upload(order.user_id, 'delivery', courierScreenshot, 'courier.jpg')
      if (saved) screenshotUrl = saved
    }

    await run(
      'UPDATE orders SET tracking_code=?, delivery_notes=COALESCE(?,delivery_notes), delivery_screenshot_url=COALESCE(?,delivery_screenshot_url), updated_at=? WHERE id=?',
      [trackingCode || order.tracking_code || '', deliveryNotes ?? null, screenshotUrl ?? null, ts, req.params.id]
    )

    // Notify user that courier details are available
    const sp = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [userId])
    await createNotification({
      userId: String(order.user_id),
      type: 'TRACKING_UPDATED',
      title: 'Courier details available',
      body: `Your order ${order.order_number} has been dispatched by ${sp?.name || 'your sales person'}. Track with: ${trackingCode || 'See portal'}`,
      orderId: String(order.id),
      requiresAction: true,
      actionType: 'CONFIRM_RECEIPT',
      metadata: { orderNumber: order.order_number, trackingCode, spName: sp?.name },
    })

    // Notify admin that SP has submitted tracking
    const admins = await query<RowDataPacket>("SELECT id FROM users WHERE role='ADMIN' AND is_active=1")
    await notifyUsers(
      admins.map(a => String(a.id)),
      {
        type: 'TRACKING_SUBMITTED',
        title: 'Courier details submitted by SP',
        body: `${sp?.name || 'Sales Person'} submitted tracking for ${order.order_number}. Waiting for customer confirmation.`,
        orderId: String(order.id),
        metadata: { orderNumber: order.order_number, trackingCode },
      }
    )

    await logAudit({
      userId,
      action: 'TRACKING_SUBMITTED',
      entityType: 'order',
      entityId: req.params.id,
      details: `Tracking submitted: ${trackingCode || 'via screenshot'}`,
    })

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Courier details submitted. Customer notified.' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── CONFIRM RECEIPT (User says Yes/No) ───────────────────────────────────────
// Simplified: When user confirms receipt, status becomes DELIVERED
// and admin gets notification to release commission
router.post('/:id/confirm-receipt', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'USER') return res.status(403).json({ success: false, error: 'Only customers can confirm receipt' })

    const { received, remark } = req.body as { received?: boolean; remark?: string }
    if (received === undefined) {
      return res.status(400).json({ success: false, error: 'received (true/false) is required' })
    }

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.user_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })
    if (order.status !== 'DISPATCHED') {
      return res.status(400).json({ success: false, error: 'Order must be in DISPATCHED status to confirm receipt' })
    }

    const ts = now()
    const customer = await queryOne<RowDataPacket>('SELECT name, organization_name FROM users WHERE id=?', [userId])
    const customerLabel = customer?.organization_name || customer?.name || 'Customer'

    if (received) {
      // User confirmed receipt -> mark as DELIVERED
      await run(
        `UPDATE orders SET status='DELIVERED', receipt_status='CONFIRMED', receipt_confirmed_at=?, receipt_remark=NULL, delivered_at=?, updated_at=? WHERE id=?`,
        [ts, ts, ts, req.params.id]
      )

      // Notify admins that user confirmed receipt - ready for commission release
      const admins = await query<RowDataPacket>("SELECT id FROM users WHERE role='ADMIN' AND is_active=1")
      await notifyUsers(
        admins.map(a => String(a.id)),
        {
          type: 'DELIVERY_CONFIRMED',
          title: 'Customer confirmed delivery',
          body: `${customerLabel} confirmed receipt of ${order.order_number}. Commission can now be released.`,
          orderId: String(order.id),
          requiresAction: true,
          actionType: 'RELEASE_COMMISSION',
          metadata: { orderNumber: order.order_number, spId: order.sp_id, customerName: customerLabel },
        }
      )

      // Notify SP
      if (order.sp_id) {
        await createNotification({
          userId: String(order.sp_id),
          type: 'RECEIPT_CONFIRMED',
          title: 'Customer confirmed receipt',
          body: `${customerLabel} confirmed order ${order.order_number} was received. Awaiting admin commission release.`,
          orderId: String(order.id),
        })
      }

      // Auto-create commission record for SP
      if (order.sp_id) {
        const spUser = await queryOne<RowDataPacket>('SELECT sp_commission_pct, sp_commission_type, sp_commission_value FROM users WHERE id=?', [order.sp_id])
        const existingCommission = await queryOne<RowDataPacket>('SELECT id FROM commissions WHERE order_id=?', [req.params.id])
        if (!existingCommission) {
          const totalAmount = Number(order.total_amount)
          const configuredValue = Number(spUser?.sp_commission_value ?? spUser?.sp_commission_pct ?? 5)
          const commission = calculateCommission(totalAmount, spUser?.sp_commission_type || 'PERCENTAGE', configuredValue)
          const commissionId = uuidv4()
          await run(
            `INSERT INTO commissions (id,sp_id,order_id,order_amount,commission_pct,commission_amount,status,created_at,updated_at)
             VALUES (?,?,?,?,?,?,'PENDING',?,?)`,
            [commissionId, order.sp_id, req.params.id, totalAmount, commission.pctForLegacyColumn, commission.amount, ts, ts]
          )
        }
      }
    } else {
      // User says NOT received
      if (!remark || String(remark).trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Remark is required when order was not received (min 3 chars)' })
      }
      await run(
        `UPDATE orders SET receipt_status='DISPUTED', receipt_remark=?, updated_at=? WHERE id=?`,
        [String(remark).trim(), ts, req.params.id]
      )

      const admins = await query<RowDataPacket>("SELECT id FROM users WHERE role='ADMIN' AND is_active=1")
      const notifyIds = [...admins.map(a => String(a.id))]
      if (order.sp_id) notifyIds.push(String(order.sp_id))
      await notifyUsers(notifyIds, {
        type: 'RECEIPT_DISPUTED',
        title: 'Order not received — dispute',
        body: `${customerLabel} reported order ${order.order_number} NOT received. Remark: ${String(remark).trim()}`,
        orderId: String(order.id),
        metadata: { remark: String(remark).trim(), orderNumber: order.order_number },
      })
    }

    await run(
      'UPDATE notifications SET is_read=1 WHERE user_id=? AND order_id=? AND action_type=?',
      [userId, req.params.id, 'CONFIRM_RECEIPT']
    )

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── NOTIFY RECEIPT (old flow - kept for backwards compatibility) ──────────────
router.post('/:id/notify-receipt', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['ADMIN', 'SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (order.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, error: 'Order must be DELIVERED status' })
    }
    const sp = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [order.sp_id])
    await createNotification({
      userId: String(order.user_id),
      type: 'DELIVERY_CONFIRM_REQUEST',
      title: 'Have you received your order?',
      body: `Your order ${order.order_number} has been delivered by ${sp?.name || 'your sales person'}. Please confirm if you received it.`,
      orderId: String(order.id),
      requiresAction: true,
      actionType: 'CONFIRM_RECEIPT',
      metadata: { orderNumber: order.order_number, spName: sp?.name },
    })
    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Customer notified' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── SEND DELIVERY MESSAGE (legacy - kept for backwards compatibility) ─────────
router.post('/:id/send-delivery-message', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Only sales persons can send delivery messages' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.sp_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })

    const ts = now()
    await run(
      `UPDATE orders SET status='DELIVERED', delivery_message_sent_at=?, updated_at=?, delivered_at=? WHERE id=?`,
      [ts, ts, ts, req.params.id]
    )
    const sp = await queryOne<RowDataPacket>('SELECT name, phone FROM users WHERE id=?', [userId])
    await createNotification({
      userId: String(order.user_id),
      type: 'DELIVERY_CONFIRM_REQUEST',
      title: 'Have you received your order?',
      body: `Your order ${order.order_number} has been delivered. Please confirm if you received it.`,
      orderId: String(order.id),
      requiresAction: true,
      actionType: 'CONFIRM_RECEIPT',
      metadata: { orderNumber: order.order_number, spName: sp?.name, spPhone: sp?.phone },
    })
    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Delivery message sent to customer' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── LEGACY: CONFIRM DELIVERY PROOF (kept for backwards compatibility) ─────────
router.post('/:id/confirm-delivery-proof', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Only sales persons can confirm delivery' })
    }
    const { deliveryScreenshot, paymentScreenshot, paymentFileName } = req.body
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.sp_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })

    const ts = now()
    let deliveryScreenshotUrl = order.delivery_screenshot_url
    let paymentScreenshotUrl = order.payment_screenshot_url

    if (deliveryScreenshot) {
      const saved = await saveBase64Upload(order.user_id, 'delivery', deliveryScreenshot, 'delivery.jpg')
      if (saved) deliveryScreenshotUrl = saved
    }
    if (paymentScreenshot) {
      const saved = await saveBase64Upload(order.user_id, 'payment', paymentScreenshot, paymentFileName || 'payment.jpg')
      if (saved) paymentScreenshotUrl = saved
    }

    await run(
      `UPDATE orders SET delivery_screenshot_url=?, payment_screenshot_url=?, status='DELIVERED', updated_at=? WHERE id=?`,
      [deliveryScreenshotUrl, paymentScreenshotUrl, ts, req.params.id]
    )

    // Create commission if not exists
    if (order.sp_id) {
      const spUser = await queryOne<RowDataPacket>('SELECT sp_commission_pct, sp_commission_type, sp_commission_value FROM users WHERE id=?', [order.sp_id])
      const existing = await queryOne<RowDataPacket>('SELECT id FROM commissions WHERE order_id=?', [req.params.id])
      if (!existing) {
        const totalAmount = Number(order.total_amount)
        const configuredValue = Number(spUser?.sp_commission_value ?? spUser?.sp_commission_pct ?? 5)
        const commission = calculateCommission(totalAmount, spUser?.sp_commission_type || 'PERCENTAGE', configuredValue)
        const commissionId = uuidv4()
        await run(
          `INSERT INTO commissions (id,sp_id,order_id,order_amount,commission_pct,commission_amount,status,created_at,updated_at)
           VALUES (?,?,?,?,?,?,'PENDING',?,?)`,
          [commissionId, order.sp_id, req.params.id, totalAmount, commission.pctForLegacyColumn, commission.amount, ts, ts]
        )
      }
    }

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Delivery proof submitted' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── LEGACY: CUSTOMER DELIVERY RESPONSE (kept for backwards compatibility) ─────
router.post('/:id/customer-delivery-response', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'USER') return res.status(403).json({ success: false, error: 'Only customers can respond' })
    const { received, remark } = req.body as { received?: boolean; remark?: string }
    if (received === undefined) {
      return res.status(400).json({ success: false, error: 'received (true/false) is required' })
    }
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.user_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })

    const ts = now()
    const customer = await queryOne<RowDataPacket>('SELECT name, organization_name FROM users WHERE id=?', [userId])
    const customerLabel = customer?.organization_name || customer?.name || 'Customer'

    if (received) {
      await run('UPDATE orders SET status=?, receipt_status=?, receipt_confirmed_at=?, updated_at=? WHERE id=?',
        ['DELIVERED', 'CONFIRMED', ts, ts, req.params.id])
      // Auto-create commission
      if (order.sp_id) {
        const spUser = await queryOne<RowDataPacket>('SELECT sp_commission_pct, sp_commission_type, sp_commission_value FROM users WHERE id=?', [order.sp_id])
        const existing = await queryOne<RowDataPacket>('SELECT id FROM commissions WHERE order_id=?', [req.params.id])
        if (!existing) {
          const totalAmount = Number(order.total_amount)
          const configuredValue = Number(spUser?.sp_commission_value ?? spUser?.sp_commission_pct ?? 5)
          const commission = calculateCommission(totalAmount, spUser?.sp_commission_type || 'PERCENTAGE', configuredValue)
          const commissionId = uuidv4()
          await run(
            `INSERT INTO commissions (id,sp_id,order_id,order_amount,commission_pct,commission_amount,status,created_at,updated_at)
             VALUES (?,?,?,?,?,?,'PENDING',?,?)`,
            [commissionId, order.sp_id, req.params.id, totalAmount, commission.pctForLegacyColumn, commission.amount, ts, ts]
          )
        }
      }
    } else {
      await run('UPDATE orders SET receipt_status=?, receipt_remark=?, updated_at=? WHERE id=?',
        ['DISPUTED', String(remark || '').trim(), ts, req.params.id])
    }

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── TRACKING INFO ─────────────────────────────────────────────────────────────
router.get('/:id/tracking', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })
    if (role === 'USER' && order.user_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })

    const sp = await queryOne<RowDataPacket>('SELECT id, name, phone FROM users WHERE id=?', [order.sp_id])
    const customer = await queryOne<RowDataPacket>('SELECT id, name, phone, organization_name FROM users WHERE id=?', [order.user_id])

    const timeline = [
      { status: 'PENDING', label: 'Order Placed', timestamp: order.created_at, completed: true },
      { status: 'PAYMENT_VERIFIED', label: 'Payment Verified', timestamp: order.payment_verified_at, completed: !!order.payment_verified_at },
      { status: 'DISPATCHED', label: 'Dispatched to SP', timestamp: order.dispatch_requested_at, completed: !!order.dispatch_requested_at },
      { status: 'IN_TRANSIT', label: 'In Transit', timestamp: null, completed: !!order.tracking_code },
      { status: 'DELIVERED', label: 'Delivered', timestamp: order.delivered_at, completed: order.status === 'DELIVERED' },
      { status: 'COMMISSION_RELEASED', label: 'Commission Released', timestamp: null, completed: false },
    ]

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        currentStatus: order.status,
        currentStatusLabel: ({
          'PENDING': 'Payment Pending',
          'APPROVED': 'Payment Verified',
          'DISPATCHED': 'In Transit',
          'DELIVERED': 'Delivered',
          'COMPLETED': 'Completed',
          'CANCELLED': 'Cancelled',
        } as Record<string, string>)[String(order.status)] || String(order.status),
        trackingCode: order.tracking_code || null,
        timeline,
        salesPerson: sp ? { id: sp.id, name: sp.name, phone: sp.phone } : null,
        customer: customer ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          organization: customer.organization_name,
        } : null,
        deliveryNotes: order.delivery_notes,
        receiptStatus: order.receipt_status,
      },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── SP CONTACT ────────────────────────────────────────────────────────────────
router.get('/:id/sp-contact', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'USER') return res.status(403).json({ success: false, error: 'Only customers can access this' })
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (order.user_id !== userId) return res.status(403).json({ success: false, error: 'Access denied' })
    const sp = await queryOne<RowDataPacket>('SELECT id, name, phone FROM users WHERE id=?', [order.sp_id])
    if (!sp) return res.status(404).json({ success: false, error: 'Sales person not found' })
    return res.json({
      success: true,
      data: { salesPerson: { id: sp.id, name: sp.name, phone: sp.phone }, orderNumber: order.order_number },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── SP PENDING VERIFICATION (legacy) ─────────────────────────────────────────
router.get('/sp-pending-verification', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'SALES_PERSON') return res.status(403).json({ success: false, error: 'Access denied' })
    const orders = await query<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, u.phone as user_phone
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       WHERE o.sp_id = ? AND o.status = 'DISPATCHED' AND o.tracking_code IS NULL
       ORDER BY o.created_at DESC`,
      [userId]
    )
    return res.json({ success: true, data: orders.map(o => formatOrder(o)) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── MARK AS PACKED (old flow - kept for backwards compat) ────────────────────
router.post('/:id/packed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'ADMIN') return res.status(403).json({ success: false, error: 'Only admins can mark orders as packed' })
    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    const ts = now()
    await run('UPDATE orders SET packed_at=?, status=?, updated_at=? WHERE id=?', [ts, 'DISPATCHED', ts, req.params.id])
    if (order.sp_id) {
      await createNotification({
        userId: String(order.sp_id),
        type: 'ORDER_PACKED',
        title: 'Order packed and ready',
        body: `Order ${order.order_number} is packed. Start delivery.`,
        orderId: String(order.id),
        requiresAction: true,
        actionType: 'START_DELIVERY',
        metadata: { orderNumber: order.order_number },
      })
    }
    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items), message: 'Order marked as packed' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
