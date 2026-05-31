import { Router, Response } from 'express'
import { queryOne, query } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatOrder } from '../utils/formatters.js'

const router: Router = Router()

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const row = await queryOne<Record<string, unknown>>(sql, params)
  return Number(row?.c ?? row?.s ?? 0)
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (role === 'ADMIN') {
      const totalUsers = await count("SELECT COUNT(*) as c FROM users WHERE role='USER'")
      const totalSPs = await count("SELECT COUNT(*) as c FROM users WHERE role='SALES_PERSON'")
      const totalProducts = await count('SELECT COUNT(*) as c FROM products WHERE is_active=1')
      const lowStock = await count(
        'SELECT COUNT(*) as c FROM products WHERE quantity <= reorder_level AND is_active=1'
      )
      const totalOrders = await count('SELECT COUNT(*) as c FROM orders')
      const pendingOrders = await count("SELECT COUNT(*) as c FROM orders WHERE status='PENDING'")
      const totalRevenue = await count(
        "SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE status != 'CANCELLED'"
      )
      const pendingPayments = await count(
        "SELECT COALESCE(SUM(total_amount-paid_amount),0) as s FROM orders WHERE payment_status != 'PAID' AND status != 'CANCELLED'"
      )

      let pendingCommissions = 0
      try {
        pendingCommissions = await count(
          "SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE status='PENDING'"
        )
      } catch {
        pendingCommissions = 0
      }

      let recentOrdersRaw: Record<string, unknown>[] = []
      try {
        recentOrdersRaw = await query(
          `SELECT o.*, u.name as user_name, u.organization_name as user_org
           FROM orders o LEFT JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 5`
        )
      } catch {
        recentOrdersRaw = []
      }

      let topProducts: { name: string; sold: number }[] = []
      try {
        const rows = await query<Record<string, unknown>>(
          `SELECT p.name, SUM(oi.quantity) as sold FROM order_items oi
           JOIN products p ON oi.product_id=p.id GROUP BY p.id ORDER BY sold DESC LIMIT 5`
        )
        topProducts = rows.map(p => ({ name: String(p.name), sold: Number(p.sold) }))
      } catch {
        topProducts = []
      }

      return res.json({
        success: true,
        data: {
          totalUsers,
          totalSPs,
          totalProducts,
          lowStock,
          totalOrders,
          pendingOrders,
          totalRevenue,
          pendingPayments,
          pendingCommissions,
          recentOrders: recentOrdersRaw.map(o => formatOrder(o)),
          topProducts,
        },
      })
    }

    if (role === 'SALES_PERSON') {
      const myCustomers = await count('SELECT COUNT(*) as c FROM users WHERE assigned_sp_id=?', [userId])
      const myOrders = await count('SELECT COUNT(*) as c FROM orders WHERE sp_id=?', [userId])
      const pendingDeliveries = await count(
        "SELECT COUNT(*) as c FROM orders WHERE sp_id=? AND status IN ('APPROVED','DISPATCHED')",
        [userId]
      )
      const totalSales = await count(
        "SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE sp_id=? AND status != 'CANCELLED'",
        [userId]
      )
      const earnedCommission = await count(
        "SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE sp_id=? AND status='PAID'",
        [userId]
      )
      const pendingCommission = await count(
        "SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE sp_id=? AND status='PENDING'",
        [userId]
      )
      const recentOrdersRaw = await query<Record<string, unknown>>(
        `SELECT o.*, u.name as user_name, u.organization_name as user_org
         FROM orders o LEFT JOIN users u ON o.user_id=u.id WHERE o.sp_id=? ORDER BY o.created_at DESC LIMIT 5`,
        [userId]
      )

      return res.json({
        success: true,
        data: {
          myCustomers,
          myOrders,
          pendingDeliveries,
          totalSales,
          earnedCommission,
          pendingCommission,
          recentOrders: recentOrdersRaw.map(o => formatOrder(o)),
        },
      })
    }

    const myOrders = await count('SELECT COUNT(*) as c FROM orders WHERE user_id=?', [userId])
    const totalSpent = await count(
      "SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE user_id=? AND status != 'CANCELLED'",
      [userId]
    )
    const outstanding = await count(
      "SELECT COALESCE(SUM(total_amount-paid_amount),0) as s FROM orders WHERE user_id=? AND payment_status != 'PAID' AND status != 'CANCELLED'",
      [userId]
    )
    const me = await queryOne<Record<string, unknown>>(
      'SELECT credit_limit, credit_used FROM users WHERE id=?',
      [userId]
    )
    const recentOrdersRaw = await query<Record<string, unknown>>(
      'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 5',
      [userId]
    )

    const creditLimit = Number(me?.credit_limit ?? 0)
    const creditUsed = Number(me?.credit_used ?? 0)

    return res.json({
      success: true,
      data: {
        myOrders,
        totalSpent,
        outstanding,
        creditLimit,
        creditUsed,
        availableCredit: creditLimit - creditUsed,
        recentOrders: recentOrdersRaw.map(o => formatOrder(o)),
      },
    })
  } catch (e) {
    console.error('Dashboard error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
