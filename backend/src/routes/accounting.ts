import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

router.get('/summary', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const req = _req as any
    const { paymentMethod, status, from, to } = req.query as Record<string, string>
    const conds = ["status != 'CANCELLED'"]
    const params: unknown[] = []
    if (paymentMethod) {
      conds.push('payment_method = ?')
      params.push(paymentMethod)
    }
    if (status) {
      conds.push('status = ?')
      params.push(status)
    }
    if (from) {
      conds.push('date(created_at) >= date(?)')
      params.push(from)
    }
    if (to) {
      conds.push('date(created_at) <= date(?)')
      params.push(to)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const revenue = await queryOne<RowDataPacket>(
      `SELECT COALESCE(SUM(total_amount),0) as v FROM orders ${where}`,
      params
    )
    const collected = await queryOne<RowDataPacket>(
      `SELECT COALESCE(SUM(paid_amount),0) as v FROM orders ${where}`,
      params
    )
    const receivables = await queryOne<RowDataPacket>(
      `SELECT COALESCE(SUM(total_amount - paid_amount),0) as v FROM orders ${where} AND payment_status != 'PAID'`,
      params
    )
    const creditExposure = await queryOne<RowDataPacket>(
      'SELECT COALESCE(SUM(credit_used),0) as v FROM users WHERE role=?',
      ['USER']
    )
    const commissionsDue = await queryOne<RowDataPacket>(
      "SELECT COALESCE(SUM(commission_amount),0) as v FROM commissions WHERE status='PENDING'"
    )
    const gstCollected = await queryOne<RowDataPacket>(
      "SELECT COALESCE(SUM(gst_amount),0) as v FROM orders WHERE status != 'CANCELLED'"
    )

    return res.json({
      success: true,
      data: {
        totalRevenue: Number(revenue?.v ?? 0),
        totalCollected: Number(collected?.v ?? 0),
        accountsReceivable: Number(receivables?.v ?? 0),
        creditExposure: Number(creditExposure?.v ?? 0),
        commissionsPayable: Number(commissionsDue?.v ?? 0),
        gstCollected: Number(gstCollected?.v ?? 0),
      },
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/backup', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<RowDataPacket>(
      'SELECT id,email,name,role,customer_type,phone,organization_name,address,territory,assigned_sp_id,commission_pct,credit_limit,credit_used,is_active,approval_status,created_at,updated_at FROM users'
    )
    const products = await query<RowDataPacket>('SELECT * FROM products')
    const orders = await query<RowDataPacket>('SELECT * FROM orders')
    const orderItems = await query<RowDataPacket>('SELECT * FROM order_items')
    const commissions = await query<RowDataPacket>('SELECT * FROM commissions')
    const ledger = await query<RowDataPacket>('SELECT * FROM ledger')
    const areas = await query<RowDataPacket>('SELECT * FROM areas')

    const generatedAt = new Date().toISOString()
    const fileName = `db-backup-${generatedAt.slice(0, 10)}-${generatedAt.slice(11, 19).replace(/:/g, '')}.json`
    const tableCounts = {
      users: users.length,
      products: products.length,
      orders: orders.length,
      orderItems: orderItems.length,
      commissions: commissions.length,
      ledger: ledger.length,
      areas: areas.length,
    }

    await run(
      'INSERT INTO backup_history (id,file_name,table_counts,created_by,created_at) VALUES (?,?,?,?,?)',
      [uuidv4(), fileName, JSON.stringify(tableCounts), req.user!.userId, generatedAt.slice(0, 19).replace('T', ' ')]
    )

    return res.json({
      success: true,
      data: {
        generatedAt,
        fileName,
        tableCounts,
        tables: { users, products, orders, orderItems, commissions, ledger, areas },
      },
    })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/backup-history', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT b.*, u.name as created_by_name
       FROM backup_history b
       LEFT JOIN users u ON b.created_by = u.id
       ORDER BY b.created_at DESC
       LIMIT 100`
    )
    return res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        fileName: r.file_name,
        tableCounts: r.table_counts ? JSON.parse(String(r.table_counts)) : null,
        createdBy: r.created_by,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
      })),
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
