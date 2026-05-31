import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { hashPassword } from '../utils/auth.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatUser } from './auth.js'
import { formatLedger } from '../utils/formatters.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// GET /api/users — ADMIN: all; SP: assigned customers only
router.get('/', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const roleFilter = req.query.role as string
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20)
    const offset = (page - 1) * pageSize

    const conds: string[] = []
    const params: unknown[] = []

    if (role === 'SALES_PERSON') {
      conds.push('assigned_sp_id = ?')
      params.push(userId)
    }
    if (roleFilter) {
      conds.push('role = ?')
      params.push(roleFilter)
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const totalRow = await queryOne<RowDataPacket>(`SELECT COUNT(*) as c FROM users ${where}`, params)
    const total = Number(totalRow?.c ?? 0)
    const users = await query<RowDataPacket>(
      `SELECT * FROM users ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    return res.json({
      success: true,
      data: { data: users.map(formatUser), total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const targetId = req.params.id
    const u = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id = ?', [targetId])
    if (!u) return res.status(404).json({ success: false, error: 'User not found' })

    if (role === 'USER' && targetId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (role === 'SALES_PERSON' && u.role === 'USER' && u.assigned_sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (role === 'SALES_PERSON' && u.role !== 'USER') {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    return res.json({ success: true, data: formatUser(u) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const {
      email, password, name, newRole, phone, organizationName, address, territory,
      commissionPct, creditLimit, assignedSpId, customerType,
    } = req.body

    if (!email || !password || !name || !newRole) {
      return res.status(400).json({ success: false, error: 'email, password, name, and role are required' })
    }
    if (role === 'SALES_PERSON' && newRole !== 'USER') {
      return res.status(403).json({ success: false, error: 'Sales persons can only create customer accounts' })
    }
    if (role === 'ADMIN' && !['SALES_PERSON', 'USER'].includes(newRole)) {
      return res.status(400).json({ success: false, error: 'Invalid role for new user' })
    }
    if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ success: false, error: 'Email already registered' })
    }

    const id = uuidv4()
    const spId = role === 'SALES_PERSON' ? userId : assignedSpId || null
    const passwordHash = await hashPassword(password)

    await run(
      `INSERT INTO users (id,email,password_hash,name,role,customer_type,phone,organization_name,address,territory,
       assigned_sp_id,commission_pct,credit_limit,is_active,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        id, email, passwordHash, name, newRole, customerType || null, phone || null,
        organizationName || null, address || null, territory || null,
        spId, commissionPct || 0, creditLimit || 0, now(), now(),
      ]
    )

    const created = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [id])
    return res.status(201).json({ success: true, data: formatUser(created!) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await queryOne('SELECT id FROM users WHERE id=?', [id]))) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const fields: Record<string, string> = {
      name: 'name', phone: 'phone', organizationName: 'organization_name',
      address: 'address', territory: 'territory', assignedSpId: 'assigned_sp_id',
      commissionPct: 'commission_pct', creditLimit: 'credit_limit',
      isBlocked: 'is_blocked', isActive: 'is_active', customerType: 'customer_type',
    }
    const sets = ['updated_at = ?']
    const params: unknown[] = [now()]
    for (const [key, col] of Object.entries(fields)) {
      if (req.body[key] !== undefined) {
        sets.push(`${col} = ?`)
        params.push(['isBlocked', 'isActive'].includes(key) ? (req.body[key] ? 1 : 0) : req.body[key])
      }
    }
    params.push(id)
    await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params)
    const updated = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [id])
    return res.json({ success: true, data: formatUser(updated!) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/:id/ledger', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const targetId = req.params.id

    if (role === 'USER' && targetId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (role === 'SALES_PERSON') {
      const customer = await queryOne<RowDataPacket>(
        'SELECT assigned_sp_id FROM users WHERE id = ? AND role = ?',
        [targetId, 'USER']
      )
      if (!customer || customer.assigned_sp_id !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }
    }

    const entries = await query<RowDataPacket>(
      'SELECT * FROM ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [targetId]
    )
    return res.json({ success: true, data: entries.map(formatLedger) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.patch('/:id/credit', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { creditLimit } = req.body
    if (creditLimit === undefined) return res.status(400).json({ success: false, error: 'creditLimit required' })
    await run('UPDATE users SET credit_limit=?, updated_at=? WHERE id=?', [creditLimit, now(), req.params.id])
    const u = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [req.params.id])
    return res.json({ success: true, data: formatUser(u!) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
