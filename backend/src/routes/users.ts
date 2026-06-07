import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { hashPassword } from '../utils/auth.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatUser } from './auth.js'
import { formatLedger } from '../utils/formatters.js'
import { logAudit } from '../utils/audit.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function makeSpReferralCode(id: string) {
  return `SP-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

// GET /api/users — ADMIN: all; SP: assigned customers only
router.get('/', authMiddleware, roleMiddleware('ADMIN', 'SALES_PERSON'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const roleFilter = req.query.role as string
    const approvalStatus = req.query.approvalStatus as string
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
    if (approvalStatus) {
      conds.push('approval_status = ?')
      params.push(approvalStatus)
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const totalRow = await queryOne<RowDataPacket>(`SELECT COUNT(*) as c FROM users ${where}`, params)
    const total = Number(totalRow?.c ?? 0)
    const users = await query<RowDataPacket>(
      `SELECT u.*, sp.name as assigned_sp_name, sp.sp_referral_code as assigned_sp_code
       FROM users u
       LEFT JOIN users sp ON u.assigned_sp_id = sp.id
       ${where.replace(/\b(assigned_sp_id|role|approval_status)\b/g, 'u.$1')} ORDER BY u.name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    return res.json({
      success: true,
      data: {
        data: users.map(u => ({
          ...formatUser(u),
          assignedSpName: u.assigned_sp_name ?? null,
          assignedSpCode: u.assigned_sp_code ?? null,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
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
      commissionPct, creditLimit, assignedSpId, customerType, areaId,
      bankAccount, bankIfsc, bankName, aadhaarDataUrl, photoDataUrl,
      billingAddress, shippingAddress, latitude, longitude,
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

    let spReferralCode: string | null = null
    let referredBySpCode: string | null = null
    let approvalStatus = 'APPROVED'
    let isActive = 1

    if (newRole === 'SALES_PERSON') {
      spReferralCode = makeSpReferralCode(id)
    }

    if (role === 'SALES_PERSON' && newRole === 'USER') {
      approvalStatus = 'PENDING'
      isActive = 0
      const sp = await queryOne<RowDataPacket>('SELECT sp_referral_code FROM users WHERE id=?', [userId])
      referredBySpCode = sp?.sp_referral_code || makeSpReferralCode(userId)
      if (!sp?.sp_referral_code) {
        await run('UPDATE users SET sp_referral_code=?, updated_at=? WHERE id=?', [referredBySpCode, now(), userId])
      }
    }

    const lat = latitude !== undefined && latitude !== '' ? Number(latitude) : null
    const lng = longitude !== undefined && longitude !== '' ? Number(longitude) : null

    await run(
      `INSERT INTO users (id,email,password_hash,name,role,customer_type,phone,organization_name,address,territory,
       assigned_sp_id,commission_pct,credit_limit,area_id,bank_account,bank_ifsc,bank_name,
       billing_address,shipping_address,latitude,longitude,referred_by_sp_code,sp_referral_code,
       approval_status,is_active,sp_commission_pct,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, email, passwordHash, name, newRole, customerType || null, phone || null,
        organizationName || null, address || null, territory || null,
        spId, commissionPct || 0, creditLimit || 0, areaId || null,
        bankAccount || null, bankIfsc || null, bankName || null,
        billingAddress || null, shippingAddress || null, lat, lng,
        referredBySpCode, spReferralCode,
        approvalStatus, isActive, null, now(), now(),
      ]
    )

    const { saveBase64Upload } = await import('../utils/save-upload.js')
    if (aadhaarDataUrl) {
      const url = await saveBase64Upload(id, 'aadhaar', aadhaarDataUrl)
      if (url) await run('UPDATE users SET aadhaar_url=?, updated_at=? WHERE id=?', [url, now(), id])
    }
    if (photoDataUrl) {
      const url = await saveBase64Upload(id, 'photo', photoDataUrl)
      if (url) await run('UPDATE users SET photo_url=?, updated_at=? WHERE id=?', [url, now(), id])
    }
    if (areaId) {
      const area = await queryOne<RowDataPacket>('SELECT name FROM areas WHERE id=?', [areaId])
      if (area?.name) {
        await run('UPDATE users SET territory=?, updated_at=? WHERE id=?', [area.name, now(), id])
      }
    }

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
    const existing = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [id])
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    if (req.body.assignedSpId !== undefined && req.body.assignedSpId) {
      const sp = await queryOne<RowDataPacket>(
        'SELECT id FROM users WHERE id=? AND role=? AND is_active=1',
        [req.body.assignedSpId, 'SALES_PERSON']
      )
      if (!sp) {
        return res.status(400).json({ success: false, error: 'Selected sales person is not active or does not exist' })
      }
    }

    const fields: Record<string, string> = {
      name: 'name', phone: 'phone', organizationName: 'organization_name',
      address: 'address', territory: 'territory', assignedSpId: 'assigned_sp_id',
      commissionPct: 'commission_pct', creditLimit: 'credit_limit',
      isBlocked: 'is_blocked', isActive: 'is_active', customerType: 'customer_type',
      areaId: 'area_id', bankAccount: 'bank_account', bankIfsc: 'bank_ifsc', bankName: 'bank_name',
      billingAddress: 'billing_address', shippingAddress: 'shipping_address',
      latitude: 'latitude', longitude: 'longitude', spCommissionPct: 'sp_commission_pct',
      spCommissionType: 'sp_commission_type', spCommissionValue: 'sp_commission_value',
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

router.patch('/:id/approve', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { approved, creditLimit, spCommissionPct, rejectionRemark } = req.body
    const u = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [req.params.id])
    if (!u) return res.status(404).json({ success: false, error: 'User not found' })

    if (approved === false) {
      if (!rejectionRemark || String(rejectionRemark).trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Rejection remark is required (min 3 characters)' })
      }
      await run(
        'UPDATE users SET approval_status=?, is_active=0, rejection_remark=?, updated_at=? WHERE id=?',
        ['REJECTED', String(rejectionRemark).trim(), now(), req.params.id]
      )
      await logAudit({
        userId: req.user!.userId,
        action: 'USER_REJECT',
        entityType: 'user',
        entityId: req.params.id,
      })
    } else {
      if (creditLimit === undefined || Number(creditLimit) < 0) {
        return res.status(400).json({ success: false, error: 'Credit limit is required for approval' })
      }
      if (!u.shipping_address && !u.address) {
        return res.status(400).json({ success: false, error: 'Shipping address must be provided before approval' })
      }
      if (!u.billing_address) {
        return res.status(400).json({ success: false, error: 'Billing address must be provided before approval' })
      }
      await run(
        `UPDATE users SET approval_status=?, is_active=1, credit_limit=?,
         sp_commission_pct=COALESCE(?, sp_commission_pct), rejection_remark=NULL, updated_at=? WHERE id=?`,
        ['APPROVED', creditLimit, spCommissionPct ?? null, now(), req.params.id]
      )
      await logAudit({
        userId: req.user!.userId,
        action: 'USER_APPROVE',
        entityType: 'user',
        entityId: req.params.id,
      })
    }
    const updated = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [req.params.id])
    return res.json({ success: true, data: formatUser(updated!) })
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
