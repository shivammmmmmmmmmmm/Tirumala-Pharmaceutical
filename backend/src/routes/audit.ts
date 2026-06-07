import { Router, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { query } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()

router.get('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50)
    const offset = (page - 1) * pageSize
    const totalRow = await query<RowDataPacket>('SELECT COUNT(*) as c FROM audit_logs')
    const total = Number(totalRow[0]?.c ?? 0)
    const rows = await query<RowDataPacket>(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset]
    )
    return res.json({
      success: true,
      data: {
        data: rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          userEmail: r.user_email,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          details: r.details,
          ipAddress: r.ip_address,
          createdAt: r.created_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
