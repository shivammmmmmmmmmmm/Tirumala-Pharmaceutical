import { Router, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { query, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatCommission } from '../utils/formatters.js'

const router: Router = Router()

router.get('/', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const conds: string[] = []
    const params: unknown[] = []
    if (role === 'SALES_PERSON') {
      conds.push('c.sp_id = ?')
      params.push(userId)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const rows = await query<RowDataPacket>(
      `SELECT c.*, o.order_number, u.name as sp_name
       FROM commissions c
       LEFT JOIN orders o ON c.order_id = o.id
       LEFT JOIN users u ON c.sp_id = u.id
       ${where} ORDER BY c.created_at DESC`,
      params
    )
    return res.json({ success: true, data: rows.map(formatCommission) })
  } catch (e) {
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
