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

router.get('/', authMiddleware, async (_req, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      'SELECT * FROM categories WHERE is_active=1 ORDER BY name'
    )
    return res.json({
      success: true,
      data: rows.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        isActive: Boolean(c.is_active),
      })),
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name required' })
    const id = uuidv4()
    const ts = now()
    await run(
      'INSERT INTO categories (id,name,description,is_active,created_at,updated_at) VALUES (?,?,?,1,?,?)',
      [id, name, description || null, ts, ts]
    )
    await logAudit({ userId: req.user!.userId, action: 'CATEGORY_CREATE', entityType: 'category', entityId: id })
    return res.status(201).json({ success: true, data: { id, name } })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isActive } = req.body
    if (!(await queryOne('SELECT id FROM categories WHERE id=?', [req.params.id]))) {
      return res.status(404).json({ success: false, error: 'Not found' })
    }
    await run(
      'UPDATE categories SET name=COALESCE(?,name), description=COALESCE(?,description), is_active=COALESCE(?,is_active), updated_at=? WHERE id=?',
      [name ?? null, description ?? null, isActive !== undefined ? (isActive ? 1 : 0) : null, now(), req.params.id]
    )
    return res.json({ success: true, message: 'Updated' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await run('UPDATE categories SET is_active=0, updated_at=? WHERE id=?', [now(), req.params.id])
    return res.json({ success: true, message: 'Deactivated' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
