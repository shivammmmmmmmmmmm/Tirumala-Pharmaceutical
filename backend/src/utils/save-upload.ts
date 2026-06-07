import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { run } from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')

export async function saveBase64Upload(
  userId: string,
  docType: string,
  dataUrl: string,
  fileName?: string
): Promise<string | null> {
  const match = String(dataUrl).match(/^data:([\w/+.-]+);base64,(.+)$/)
  if (!match) return null
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 5 * 1024 * 1024) return null

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
  return relPath
}
