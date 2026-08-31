import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()
function now() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim()
    const activeOnly = req.query.activeOnly !== '0'
    const conds: string[] = []
    const params: unknown[] = []
    if (activeOnly) conds.push('is_active = 1')
    if (search) { conds.push('name LIKE ?'); params.push(`%${search}%`) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const rows = await query<RowDataPacket>(`SELECT * FROM compositions ${where} ORDER BY name`, params)
    return res.json({
      success: true,
      data: rows.map(r => ({ id: r.id, name: r.name, description: r.description || null, isActive: Boolean(r.is_active) })),
    })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name required' })
    // Return existing if duplicate
    const existing = await queryOne<RowDataPacket>('SELECT * FROM compositions WHERE name=?', [name])
    if (existing) return res.status(200).json({ success: true, data: { id: existing.id, name: existing.name, description: existing.description || null, isActive: Boolean(existing.is_active) } })
    const id = uuidv4(); const ts = now()
    await run('INSERT INTO compositions (id,name,description,is_active,created_at,updated_at) VALUES (?,?,?,1,?,?)',
      [id, name, description || null, ts, ts])
    return res.status(201).json({ success: true, data: { id, name, description: description || null, isActive: true } })
  } catch (e) { console.error(e); return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await queryOne('SELECT id FROM compositions WHERE id=?', [req.params.id])))
      return res.status(404).json({ success: false, error: 'Not found' })
    const { name, description, isActive } = req.body
    await run(
      'UPDATE compositions SET name=COALESCE(?,name), description=COALESCE(?,description), is_active=COALESCE(?,is_active), updated_at=? WHERE id=?',
      [name ?? null, description ?? null, isActive !== undefined ? (isActive ? 1 : 0) : null, now(), req.params.id]
    )
    const updated = await queryOne<RowDataPacket>('SELECT * FROM compositions WHERE id=?', [req.params.id])
    return res.json({ success: true, data: { id: updated!.id, name: updated!.name, description: updated!.description || null, isActive: Boolean(updated!.is_active) } })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await run('UPDATE compositions SET is_active=0, updated_at=? WHERE id=?', [now(), req.params.id])
    return res.json({ success: true })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

export default router
