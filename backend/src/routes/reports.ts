import { Router, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { query } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

router.get('/sales', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const from = (req.query.from as string) || ''
    const to = (req.query.to as string) || ''
    const conds = ["o.status NOT IN ('CANCELLED')"]
    const params: unknown[] = []
    if (from) {
      conds.push('o.created_at >= ?')
      params.push(from)
    }
    if (to) {
      conds.push('o.created_at <= ?')
      params.push(to + ' 23:59:59')
    }
    const where = `WHERE ${conds.join(' AND ')}`
    const rows = await query<RowDataPacket>(
      `SELECT DATE(o.created_at) as day, COUNT(*) as order_count, SUM(o.total_amount) as revenue
       FROM orders o ${where} GROUP BY DATE(o.created_at) ORDER BY day DESC LIMIT 90`,
      params
    )
    const summary = await query<RowDataPacket>(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0) as total_revenue,
              COALESCE(SUM(total_amount - paid_amount),0) as outstanding
       FROM orders o ${where}`,
      params
    )
    return res.json({ success: true, data: { summary: summary[0], daily: rows } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/area-wise', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT COALESCE(u.territory, 'Unassigned') as area,
              COUNT(DISTINCT u.id) as customers,
              COUNT(o.id) as orders,
              COALESCE(SUM(o.total_amount),0) as revenue
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id AND o.status NOT IN ('CANCELLED')
       WHERE u.role = 'USER'
       GROUP BY COALESCE(u.territory, 'Unassigned')
       ORDER BY revenue DESC`
    )
    return res.json({ success: true, data: rows })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/products', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT oi.product_name as name, SUM(oi.quantity) as units_sold, SUM(oi.total_price) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('CANCELLED')
       GROUP BY oi.product_id, oi.product_name
       ORDER BY units_sold DESC LIMIT 50`
    )
    return res.json({ success: true, data: rows })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/pending-payments', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const conds = ["o.payment_status != 'PAID'", "o.status NOT IN ('CANCELLED')"]
    const params: unknown[] = []
    if (role === 'SALES_PERSON') {
      conds.push('o.sp_id = ?')
      params.push(userId)
    }
    const rows = await query<RowDataPacket>(
      `SELECT o.id, o.order_number, o.total_amount, o.paid_amount,
              (o.total_amount - o.paid_amount) as due, o.payment_status, o.created_at,
              u.name as customer_name, u.organization_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE ${conds.join(' AND ')}
       ORDER BY o.created_at DESC LIMIT 100`,
      params
    )
    return res.json({ success: true, data: rows })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/commissions', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT c.status, COUNT(*) as count, SUM(c.commission_amount) as total
       FROM commissions c GROUP BY c.status`
    )
    return res.json({ success: true, data: rows })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/export', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const type = (req.query.type as string) || 'sales'
    let rows: RowDataPacket[] = []
    if (type === 'sales') {
      rows = await query<RowDataPacket>(
        `SELECT order_number, status, payment_status, total_amount, paid_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 500`
      )
    } else if (type === 'users') {
      rows = await query<RowDataPacket>(
        `SELECT name, email, role, customer_type, credit_limit, credit_used, territory, is_blocked FROM users ORDER BY name`
      )
    } else {
      rows = await query<RowDataPacket>(
        `SELECT name, sku, category, ingredients, quantity, selling_price FROM products WHERE is_active=1 ORDER BY name`
      )
    }
    const headers = rows.length ? Object.keys(rows[0]) : []
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`)
    return res.send(csv)
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
