import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse, PaginatedResponse } from '../types.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

router.get('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50)
    const offset = (page - 1) * pageSize

    const totalRow = await queryOne<RowDataPacket>('SELECT COUNT(*) as total FROM product_pricing')
    const total = Number(totalRow?.total ?? 0)

    const pricing = await query<RowDataPacket>(
      `SELECT pp.*, p.name as product_name, p.sku as product_sku
       FROM product_pricing pp
       LEFT JOIN products p ON pp.product_id = p.id
       ORDER BY pp.created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset]
    )

    return res.status(200).json({
      success: true,
      data: { data: pricing, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } as PaginatedResponse<unknown>,
    } as ApiResponse)
  } catch (error) {
    console.error('Get pricing error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { productId, role, price, minQuantity, maxQuantity, effectiveFrom, effectiveTo } = req.body
    if (!productId || !role || price === undefined) {
      return res.status(400).json({ success: false, error: 'productId, role, and price are required' } as ApiResponse)
    }
    if (!(await queryOne('SELECT id FROM products WHERE id = ?', [productId]))) {
      return res.status(404).json({ success: false, error: 'Product not found' } as ApiResponse)
    }

    const id = uuidv4()
    const ts = now()
    await run(
      `INSERT INTO product_pricing (id, product_id, role, price, min_quantity, max_quantity, effective_from, effective_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, productId, role, price, minQuantity ?? 1, maxQuantity ?? null, effectiveFrom ?? ts, effectiveTo ?? null, ts, ts]
    )

    const created = await queryOne<RowDataPacket>('SELECT * FROM product_pricing WHERE id = ?', [id])
    return res.status(201).json({ success: true, data: created } as ApiResponse)
  } catch (error) {
    console.error('Create pricing error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { price, minQuantity, maxQuantity, effectiveTo } = req.body

    if (!(await queryOne('SELECT id FROM product_pricing WHERE id = ?', [id]))) {
      return res.status(404).json({ success: false, error: 'Pricing record not found' } as ApiResponse)
    }

    const setClauses: string[] = ['updated_at = ?']
    const params: unknown[] = [now()]

    if (price !== undefined) { setClauses.push('price = ?'); params.push(price) }
    if (minQuantity !== undefined) { setClauses.push('min_quantity = ?'); params.push(minQuantity) }
    if (maxQuantity !== undefined) { setClauses.push('max_quantity = ?'); params.push(maxQuantity) }
    if (effectiveTo !== undefined) { setClauses.push('effective_to = ?'); params.push(effectiveTo ?? null) }

    params.push(id)
    await run(`UPDATE product_pricing SET ${setClauses.join(', ')} WHERE id = ?`, params)

    const updated = await queryOne<RowDataPacket>('SELECT * FROM product_pricing WHERE id = ?', [id])
    return res.status(200).json({ success: true, data: updated } as ApiResponse)
  } catch (error) {
    console.error('Update pricing error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await queryOne('SELECT id FROM product_pricing WHERE id = ?', [id]))) {
      return res.status(404).json({ success: false, error: 'Pricing record not found' } as ApiResponse)
    }
    await run('DELETE FROM product_pricing WHERE id = ?', [id])
    return res.status(200).json({ success: true, message: 'Pricing record deleted' } as ApiResponse)
  } catch (error) {
    console.error('Delete pricing error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

export default router
