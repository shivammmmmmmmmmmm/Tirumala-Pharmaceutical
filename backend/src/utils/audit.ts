import { v4 as uuidv4 } from 'uuid'
import { run } from '../db/index.js'

export async function logAudit(opts: {
  userId?: string | null
  action: string
  entityType?: string
  entityId?: string
  details?: string
  ip?: string
}) {
  try {
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await run(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        uuidv4(),
        opts.userId ?? null,
        opts.action,
        opts.entityType ?? null,
        opts.entityId ?? null,
        opts.details ?? null,
        opts.ip ?? null,
        ts,
      ]
    )
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}
