import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

router.get('/low-stock', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT id, name, sku, quantity, reorder_level, category FROM products
       WHERE is_active=1 AND quantity <= reorder_level ORDER BY quantity ASC`
    )
    return res.json({ success: true, data: rows })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/alerts', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const low = await query<RowDataPacket>(
      `SELECT COUNT(*) as c FROM products WHERE is_active=1 AND quantity <= reorder_level`
    )
    const { getActiveDriver } = await import('../db/index.js')
    const expiringSql =
      getActiveDriver() === 'sqlite'
        ? `SELECT COUNT(*) as c FROM products WHERE is_active=1 AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+90 days')`
        : `SELECT COUNT(*) as c FROM products WHERE is_active=1 AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`
    const expiring = await query<RowDataPacket>(expiringSql)
    return res.json({
      success: true,
      data: { lowStockCount: Number(low[0]?.c ?? 0), expiringSoonCount: Number(expiring[0]?.c ?? 0) },
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/adjust', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { productId, delta, reason } = req.body
    if (!productId || delta === undefined || delta === null || delta === '' || !Number.isFinite(Number(delta))) {
      return res.status(400).json({ success: false, error: 'A product ID and valid stock adjustment are required' })
    }
    const p = await queryOne<RowDataPacket>('SELECT * FROM products WHERE id=?', [productId])
    if (!p) return res.status(404).json({ success: false, error: 'Product not found' })

    const newQty = Math.max(0, Number(p.quantity) + Number(delta))
    const ts = now()
    await run('UPDATE products SET quantity=?, updated_at=? WHERE id=?', [newQty, ts, productId])
    await run(
      `INSERT INTO stock_adjustments (id,product_id,delta,quantity_before,quantity_after,reason,admin_id,created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuidv4(), productId, delta, p.quantity, newQty, reason || 'Manual adjustment', req.user!.userId, ts]
    )
    await logAudit({
      userId: req.user!.userId,
      action: 'STOCK_ADJUST',
      entityType: 'product',
      entityId: productId,
      details: `delta=${delta}`,
    })
    return res.json({ success: true, data: { quantity: newQty } })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/history', authMiddleware, roleMiddleware('ADMIN'), async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT s.*, p.name as product_name FROM stock_adjustments s
       JOIN products p ON p.id = s.product_id ORDER BY s.created_at DESC LIMIT 100`
    )
    return res.json({ success: true, data: rows })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
