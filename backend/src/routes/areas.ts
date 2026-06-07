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
      'SELECT * FROM areas WHERE is_active = 1 ORDER BY name'
    )
    return res.json({
      success: true,
      data: rows.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        sourceMode: a.source_mode ?? null,
        isActive: Boolean(a.is_active),
      })),
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, latitude, longitude, sourceMode } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name required' })
    const lat = latitude !== undefined && latitude !== '' ? Number(latitude) : null
    const lng = longitude !== undefined && longitude !== '' ? Number(longitude) : null
    if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) {
      return res.status(400).json({ success: false, error: 'Invalid latitude/longitude' })
    }
    const mode = sourceMode === 'ONLINE' || sourceMode === 'OFFLINE' ? sourceMode : null
    const id = uuidv4()
    const ts = now()
    await run(
      'INSERT INTO areas (id, name, description, latitude, longitude, source_mode, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?)',
      [id, name, description || null, lat, lng, mode, ts, ts]
    )
    await logAudit({ userId: req.user!.userId, action: 'AREA_CREATE', entityType: 'area', entityId: id })
    return res.status(201).json({ success: true, data: { id, name, description, latitude: lat, longitude: lng, sourceMode: mode } })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isActive, latitude, longitude, sourceMode } = req.body
    if (!(await queryOne('SELECT id FROM areas WHERE id=?', [req.params.id]))) {
      return res.status(404).json({ success: false, error: 'Area not found' })
    }
    await run(
      'UPDATE areas SET name=COALESCE(?,name), description=COALESCE(?,description), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), source_mode=COALESCE(?,source_mode), is_active=COALESCE(?,is_active), updated_at=? WHERE id=?',
      [
        name ?? null,
        description ?? null,
        latitude !== undefined && latitude !== '' ? Number(latitude) : null,
        longitude !== undefined && longitude !== '' ? Number(longitude) : null,
        sourceMode === 'ONLINE' || sourceMode === 'OFFLINE' ? sourceMode : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        now(),
        req.params.id,
      ]
    )
    return res.json({ success: true, message: 'Updated' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
