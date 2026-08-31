import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router: Router = Router()

function now() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

function fmt(c: Record<string, unknown>) {
  return {
    id: c.id, name: c.name, mfgCode: c.mfg_code || null,
    address: c.address || null, city: c.city || null, phone: c.phone || null,
    orderPct1: Number(c.order_pct_1 ?? 0), orderPct2: Number(c.order_pct_2 ?? 0),
    orderPct3: Number(c.order_pct_3 ?? 0), orderFactor: Number(c.order_factor ?? 1),
    stopOperations: Boolean(c.stop_operations),
    allowMobileAnalysis: Boolean(c.allow_mobile_analysis),
    mrMobile: c.mr_mobile || null, mrEmail: c.mr_email || null,
    asmMobile: c.asm_mobile || null, asmEmail: c.asm_email || null,
    rsmMobile: c.rsm_mobile || null, rsmEmail: c.rsm_email || null,
    isActive: Boolean(c.is_active), createdAt: c.created_at, updatedAt: c.updated_at,
  }
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim()
    const activeOnly = req.query.activeOnly !== '0'
    const conds: string[] = []
    const params: unknown[] = []
    if (activeOnly) { conds.push('is_active = 1') }
    if (search) { conds.push('name LIKE ?'); params.push(`%${search}%`) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const rows = await query<RowDataPacket>(`SELECT * FROM companies ${where} ORDER BY name`, params)
    return res.json({ success: true, data: rows.map(r => fmt(r as Record<string, unknown>)) })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne<RowDataPacket>('SELECT * FROM companies WHERE id=?', [req.params.id])
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    return res.json({ success: true, data: fmt(row as Record<string, unknown>) })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, mfgCode, address, city, phone, orderPct1, orderPct2, orderPct3, orderFactor,
      stopOperations, allowMobileAnalysis, mrMobile, mrEmail, asmMobile, asmEmail, rsmMobile, rsmEmail } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name required' })
    const id = uuidv4(); const ts = now()
    await run(
      `INSERT INTO companies (id,name,mfg_code,address,city,phone,order_pct_1,order_pct_2,order_pct_3,
       order_factor,stop_operations,allow_mobile_analysis,mr_mobile,mr_email,asm_mobile,asm_email,
       rsm_mobile,rsm_email,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [id, name, mfgCode||null, address||null, city||null, phone||null,
       orderPct1||0, orderPct2||0, orderPct3||0, orderFactor||1,
       stopOperations ? 1 : 0, allowMobileAnalysis ? 1 : 0,
       mrMobile||null, mrEmail||null, asmMobile||null, asmEmail||null, rsmMobile||null, rsmEmail||null, ts, ts]
    )
    await logAudit({ userId: req.user!.userId, action: 'COMPANY_CREATE', entityType: 'company', entityId: id })
    const created = await queryOne<RowDataPacket>('SELECT * FROM companies WHERE id=?', [id])
    return res.status(201).json({ success: true, data: fmt(created! as Record<string, unknown>) })
  } catch (e) { console.error(e); return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await queryOne('SELECT id FROM companies WHERE id=?', [req.params.id]))) {
      return res.status(404).json({ success: false, error: 'Not found' })
    }
    const fieldMap: Record<string, string> = {
      name: 'name', mfgCode: 'mfg_code', address: 'address', city: 'city', phone: 'phone',
      orderPct1: 'order_pct_1', orderPct2: 'order_pct_2', orderPct3: 'order_pct_3',
      orderFactor: 'order_factor', stopOperations: 'stop_operations',
      allowMobileAnalysis: 'allow_mobile_analysis', mrMobile: 'mr_mobile', mrEmail: 'mr_email',
      asmMobile: 'asm_mobile', asmEmail: 'asm_email', rsmMobile: 'rsm_mobile', rsmEmail: 'rsm_email',
      isActive: 'is_active',
    }
    const boolFields = new Set(['stopOperations', 'allowMobileAnalysis', 'isActive'])
    const sets = ['updated_at = ?']; const params: unknown[] = [now()]
    for (const [key, col] of Object.entries(fieldMap)) {
      if (req.body[key] !== undefined) {
        sets.push(`${col} = ?`)
        params.push(boolFields.has(key) ? (req.body[key] ? 1 : 0) : req.body[key])
      }
    }
    params.push(req.params.id)
    await run(`UPDATE companies SET ${sets.join(', ')} WHERE id=?`, params)
    const updated = await queryOne<RowDataPacket>('SELECT * FROM companies WHERE id=?', [req.params.id])
    return res.json({ success: true, data: fmt(updated! as Record<string, unknown>) })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    await run('UPDATE companies SET is_active=0, updated_at=? WHERE id=?', [now(), req.params.id])
    return res.json({ success: true, message: 'Deactivated' })
  } catch (e) { return res.status(500).json({ success: false, error: 'Internal server error' }) }
})

export default router
