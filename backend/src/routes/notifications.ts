import { Router, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { query, run, queryOne } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { verifyToken } from '../utils/auth.js'
import { formatNotification, getUnreadCount } from '../utils/notifications.js'
import { subscribe } from '../utils/notification-hub.js'

const router: Router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const unreadOnly = req.query.unreadOnly === '1'
    const rows = await query<RowDataPacket>(
      `SELECT * FROM notifications WHERE user_id=? ${unreadOnly ? 'AND is_read=0' : ''} ORDER BY created_at DESC LIMIT 50`,
      [userId]
    )
    const unread = await getUnreadCount(userId)
    return res.json({
      success: true,
      data: { notifications: rows.map(formatNotification), unreadCount: unread },
    })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/stream', async (req, res: Response) => {
  const token = (req.query.token as string) || ''
  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const userId = payload.userId
  const send = (chunk: string) => res.write(chunk)

  send(`data: ${JSON.stringify({ event: 'connected' })}\n\n`)

  const unsubscribe = subscribe(userId, send)

  const heartbeat = setInterval(() => {
    send(`data: ${JSON.stringify({ event: 'ping', ts: Date.now() })}\n\n`)
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne<RowDataPacket>(
      'SELECT id FROM notifications WHERE id=? AND user_id=?',
      [req.params.id, req.user!.userId]
    )
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    await run('UPDATE notifications SET is_read=1 WHERE id=?', [req.params.id])
    return res.json({ success: true })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 🗑️ DELETE notification
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne<RowDataPacket>(
      'SELECT id FROM notifications WHERE id=? AND user_id=?',
      [req.params.id, req.user!.userId]
    )
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    await run('DELETE FROM notifications WHERE id=?', [req.params.id])
    return res.json({ success: true })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await run('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user!.userId])
    return res.json({ success: true })
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
