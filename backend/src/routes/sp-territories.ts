import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// All routes require SALES_PERSON role
router.use(authMiddleware, roleMiddleware('SALES_PERSON'))

// GET /api/sp-territories - List all territories for the logged-in sales person
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<RowDataPacket>(
      `SELECT * FROM sp_territories WHERE sp_id = ? ORDER BY created_at DESC`,
      [req.user!.userId]
    )
    return res.json({
      success: true,
      data: rows.map(t => ({
        id: t.id,
        name: t.name,
        address: t.address,
        latitude: t.latitude,
        longitude: t.longitude,
        notes: t.notes,
        isActive: Boolean(t.is_active),
        createdAt: t.created_at,
      })),
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// POST /api/sp-territories - Create a new territory
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, latitude, longitude, notes } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' })
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' })
    }
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'Invalid latitude/longitude' })
    }

    const id = uuidv4()
    const ts = now()
    await run(
      `INSERT INTO sp_territories (id, sp_id, name, address, latitude, longitude, notes, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)`,
      [id, req.user!.userId, name, address || null, lat, lng, notes || null, ts, ts]
    )
    return res.status(201).json({
      success: true,
      data: { id, name, address, latitude: lat, longitude: lng, notes: notes || null, isActive: true },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// PUT /api/sp-territories/:id - Update a territory
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await queryOne<RowDataPacket>(
      'SELECT id FROM sp_territories WHERE id=? AND sp_id=?',
      [req.params.id, req.user!.userId]
    )
    if (!existing) return res.status(404).json({ success: false, error: 'Territory not found' })

    const { name, address, latitude, longitude, notes } = req.body
    const lat = latitude !== undefined && latitude !== '' ? Number(latitude) : null
    const lng = longitude !== undefined && longitude !== '' ? Number(longitude) : null
    if (lat !== null && Number.isNaN(lat)) {
      return res.status(400).json({ success: false, error: 'Invalid latitude' })
    }
    if (lng !== null && Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'Invalid longitude' })
    }

    await run(
      `UPDATE sp_territories SET name=COALESCE(?,name), address=COALESCE(?,address), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), notes=COALESCE(?,notes), updated_at=? WHERE id=?`,
      [name ?? null, address ?? null, lat, lng, notes ?? null, now(), req.params.id]
    )
    return res.json({ success: true, message: 'Updated' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// DELETE /api/sp-territories/:id - Delete a territory
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await queryOne<RowDataPacket>(
      'SELECT id FROM sp_territories WHERE id=? AND sp_id=?',
      [req.params.id, req.user!.userId]
    )
    if (!existing) return res.status(404).json({ success: false, error: 'Territory not found' })

    await run('DELETE FROM sp_territories WHERE id=?', [req.params.id])
    return res.json({ success: true, message: 'Deleted' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router