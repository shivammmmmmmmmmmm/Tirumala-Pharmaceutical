import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { run, queryOne } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'

const router: Router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')

const ALLOWED_TYPES = ['aadhaar', 'photo', 'license', 'document']
const MAX_BYTES = 5 * 1024 * 1024

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { docType, fileName, dataUrl, targetUserId } = req.body
    if (!docType || !dataUrl || !ALLOWED_TYPES.includes(docType)) {
      return res.status(400).json({ success: false, error: 'Invalid upload payload' })
    }
    const match = String(dataUrl).match(/^data:([\w/+.-]+);base64,(.+)$/)
    if (!match) return res.status(400).json({ success: false, error: 'Expected base64 data URL' })

    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ success: false, error: 'File exceeds 5MB limit' })
    }

    const userId = targetUserId && req.user!.role !== 'USER' ? targetUserId : req.user!.userId
    if (targetUserId && req.user!.role === 'USER' && targetUserId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const ext = (fileName && path.extname(fileName)) || '.jpg'
    const safeExt = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'].includes(ext.toLowerCase()) ? ext : '.jpg'
    const fileId = uuidv4()
    const relPath = `/uploads/${fileId}${safeExt}`
    fs.writeFileSync(path.join(UPLOAD_DIR, `${fileId}${safeExt}`), buffer)

    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await run(
      'INSERT INTO user_documents (id, user_id, doc_type, file_url, created_at) VALUES (?,?,?,?,?)',
      [fileId, userId, docType, relPath, ts]
    )

    const colMap: Record<string, string> = {
      aadhaar: 'aadhaar_url',
      photo: 'photo_url',
    }
    if (colMap[docType]) {
      await run(`UPDATE users SET ${colMap[docType]} = ?, updated_at = ? WHERE id = ?`, [relPath, ts, userId])
    }

    return res.status(201).json({ success: true, data: { url: relPath, docType } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Upload failed' })
  }
})

router.get('/user/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const target = req.params.userId
    if (role === 'USER' && target !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const u = await queryOne('SELECT aadhaar_url, photo_url FROM users WHERE id=?', [target])
    return res.json({ success: true, data: u })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
