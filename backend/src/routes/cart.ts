import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { resolveUnitPrice } from '../utils/pricing.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT c.product_id, c.quantity, p.id, p.name, p.sku, p.quantity as stock, p.selling_price, p.discount_pct, p.image_url, p.is_active
       FROM cart_items c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user!.userId]
    )
    const items = await Promise.all(
      rows.map(async r => ({
        productId: r.product_id,
        quantity: r.quantity,
        name: r.name,
        sku: r.sku,
        stock: r.stock,
        unitPrice: await resolveUnitPrice(r as RowDataPacket, req.user!.role, r.quantity),
        discountPct: Number(r.discount_pct) || 0,
        imageUrl: r.image_url,
        isActive: Boolean(r.is_active),
      }))
    )
    return res.json({ success: true, data: items })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity } = req.body
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, error: 'productId and quantity required' })
    }
    const product = await queryOne('SELECT id FROM products WHERE id=? AND is_active=1', [productId])
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' })

    const existing = await queryOne<RowDataPacket>(
      'SELECT id, quantity FROM cart_items WHERE user_id=? AND product_id=?',
      [req.user!.userId, productId]
    )
    const ts = now()
    if (existing) {
      await run('UPDATE cart_items SET quantity=?, updated_at=? WHERE id=?', [
        existing.quantity + quantity,
        ts,
        existing.id,
      ])
    } else {
      await run(
        'INSERT INTO cart_items (id,user_id,product_id,quantity,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        [uuidv4(), req.user!.userId, productId, quantity, ts, ts]
      )
    }
    return res.json({ success: true, message: 'Added to cart' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.put('/:productId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { quantity } = req.body
    if (quantity <= 0) {
      await run('DELETE FROM cart_items WHERE user_id=? AND product_id=?', [
        req.user!.userId,
        req.params.productId,
      ])
      return res.json({ success: true, message: 'Removed' })
    }
    await run('UPDATE cart_items SET quantity=?, updated_at=? WHERE user_id=? AND product_id=?', [
      quantity,
      now(),
      req.user!.userId,
      req.params.productId,
    ])
    return res.json({ success: true, message: 'Updated' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await run('DELETE FROM cart_items WHERE user_id=?', [req.user!.userId])
    return res.json({ success: true, message: 'Cart cleared' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
