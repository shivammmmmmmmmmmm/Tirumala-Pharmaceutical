import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()
function now() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

function fmt(r: Record<string, unknown>) {
  return { id: r.id, name: r.name, code: r.code || null, percentage: Number(r.percentage ?? 0), isActive: Boolean(r.is_active) }
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly !== '0'
    const where = activeOnly ? 'WHERE is_active=1' : ''
    const rows = await query<RowDataPacket>(`SELECT * FROM gst_rates ${where} ORDER BY percentage`)
    return res.json({ success: true, data: rows.map(r => fmt(r as Record<string, unknown>)) })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, percentage } = req.body
    if (!name || percentage === undefined) return res.status(400).json({ success: false, error: 'name and percentage required' })
    const id = uuidv4(); const ts = now()
    await run('INSERT INTO gst_rates (id,name,code,percentage,is_active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)',
      [id, name, code || null, Number(percentage), ts, ts])
    return res.status(201).json({ success: true, data: { id, name, code: code || null, percentage: Number(percentage), isActive: true } })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await queryOne('SELECT id FROM gst_rates WHERE id=?', [req.params.id])))
      return res.status(404).json({ success: false, error: 'Not found' })
    const { name, code, percentage, isActive } = req.body
    await run(
      'UPDATE gst_rates SET name=COALESCE(?,name), code=COALESCE(?,code), percentage=COALESCE(?,percentage), is_active=COALESCE(?,is_active), updated_at=? WHERE id=?',
      [name ?? null, code ?? null, percentage !== undefined ? Number(percentage) : null, isActive !== undefined ? (isActive ? 1 : 0) : null, now(), req.params.id]
    )
    const updated = await queryOne<RowDataPacket>('SELECT * FROM gst_rates WHERE id=?', [req.params.id])
    return res.json({ success: true, data: fmt(updated! as Record<string, unknown>) })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await run('UPDATE gst_rates SET is_active=0, updated_at=? WHERE id=?', [now(), req.params.id])
    return res.json({ success: true })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

export default router
