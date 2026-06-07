import { Router, Response } from 'express'
import { queryOne, query } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatOrder } from '../utils/formatters.js'

const router: Router = Router()

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const row = await queryOne<Record<string, unknown>>(sql, params)
  return Number(row?.c ?? row?.s ?? 0)
}

async function safeCount(sql: string, params: unknown[] = []): Promise<number> {
  try { return await count(sql, params) } catch { return 0 }
}

async function safeQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try { return await query<T>(sql, params) } catch { return [] }
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (role === 'ADMIN') {
      // Run ALL queries in parallel — no sequential awaits
      const [
        totalUsers, totalSPs, totalProducts, lowStock,
        totalOrders, pendingOrders, totalRevenue, pendingPayments,
        pendingCommissions, recentOrdersRaw, lowStockRaw, topProductsRaw,
      ] = await Promise.all([
        count("SELECT COUNT(*) as c FROM users WHERE role='USER'"),
        count("SELECT COUNT(*) as c FROM users WHERE role='SALES_PERSON'"),
        count('SELECT COUNT(*) as c FROM products WHERE is_active=1'),
        count('SELECT COUNT(*) as c FROM products WHERE quantity <= reorder_level AND is_active=1'),
        count('SELECT COUNT(*) as c FROM orders'),
        count("SELECT COUNT(*) as c FROM orders WHERE status='PENDING'"),
        count("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE status != 'CANCELLED'"),
        count("SELECT COALESCE(SUM(total_amount-paid_amount),0) as s FROM orders WHERE payment_status != 'PAID' AND status != 'CANCELLED'"),
        safeCount("SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE status='PENDING'"),
        safeQuery(
          `SELECT o.*, u.name as user_name, u.organization_name as user_org
           FROM orders o LEFT JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 5`
        ),
        safeQuery<Record<string, unknown>>(
          `SELECT name, quantity, reorder_level as reorderLevel FROM products
           WHERE is_active=1 AND quantity <= reorder_level ORDER BY quantity ASC LIMIT 10`
        ),
        safeQuery<Record<string, unknown>>(
          `SELECT p.name, SUM(oi.quantity) as sold FROM order_items oi
           JOIN products p ON oi.product_id=p.id GROUP BY p.id ORDER BY sold DESC LIMIT 5`
        ),
      ])

      return res.json({
        success: true,
        data: {
          totalUsers, totalSPs, totalProducts, lowStock,
          totalOrders, pendingOrders, totalRevenue, pendingPayments, pendingCommissions,
          recentOrders: recentOrdersRaw.map(o => formatOrder(o as Record<string, unknown>)),
          lowStockProducts: lowStockRaw.map(p => ({
            name: String(p.name), quantity: Number(p.quantity), reorderLevel: Number(p.reorderLevel),
          })),
          topProducts: topProductsRaw.map(p => ({ name: String(p.name), sold: Number(p.sold) })),
        },
      })
    }

    if (role === 'SALES_PERSON') {
      const monthStart = new Date()
      monthStart.setDate(1)
      const ms = monthStart.toISOString().slice(0, 10)

      // All SP queries in parallel
      const [
        myCustomers, myOrders, pendingDeliveries, totalSales,
        earnedCommission, pendingCommission, monthlySales, monthlyOrders,
        recentOrdersRaw,
      ] = await Promise.all([
        count('SELECT COUNT(*) as c FROM users WHERE assigned_sp_id=?', [userId]),
        count('SELECT COUNT(*) as c FROM orders WHERE sp_id=?', [userId]),
        count("SELECT COUNT(*) as c FROM orders WHERE sp_id=? AND status IN ('APPROVED','DISPATCHED')", [userId]),
        count("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE sp_id=? AND status != 'CANCELLED'", [userId]),
        safeCount("SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE sp_id=? AND status='PAID'", [userId]),
        safeCount("SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE sp_id=? AND status='PENDING'", [userId]),
        count("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE sp_id=? AND status != 'CANCELLED' AND created_at >= ?", [userId, ms]),
        count("SELECT COUNT(*) as c FROM orders WHERE sp_id=? AND created_at >= ?", [userId, ms]),
        query<Record<string, unknown>>(
          `SELECT o.*, u.name as user_name, u.organization_name as user_org
           FROM orders o LEFT JOIN users u ON o.user_id=u.id WHERE o.sp_id=? ORDER BY o.created_at DESC LIMIT 5`,
          [userId]
        ),
      ])

      return res.json({
        success: true,
        data: {
          myCustomers, myOrders, pendingDeliveries, totalSales,
          earnedCommission, pendingCommission, monthlySales, monthlyOrders,
          recentOrders: recentOrdersRaw.map(o => formatOrder(o)),
        },
      })
    }

    // USER role — all in parallel
    const [myOrders, totalSpent, outstanding, me, recentOrdersRaw] = await Promise.all([
      count('SELECT COUNT(*) as c FROM orders WHERE user_id=?', [userId]),
      count("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE user_id=? AND status != 'CANCELLED'", [userId]),
      count("SELECT COALESCE(SUM(total_amount-paid_amount),0) as s FROM orders WHERE user_id=? AND payment_status != 'PAID' AND status != 'CANCELLED'", [userId]),
      queryOne<Record<string, unknown>>('SELECT credit_limit, credit_used FROM users WHERE id=?', [userId]),
      query<Record<string, unknown>>('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 5', [userId]),
    ])

    const creditLimit = Number(me?.credit_limit ?? 0)
    const creditUsed  = Number(me?.credit_used ?? 0)

    return res.json({
      success: true,
      data: {
        myOrders, totalSpent, outstanding,
        creditLimit, creditUsed,
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
