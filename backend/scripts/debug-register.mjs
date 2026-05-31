import 'dotenv/config'
process.env.DB_DRIVER = 'sqlite'

const { initDatabase, run, query } = await import('../src/db/index.js')
const { hashPassword } = await import('../src/utils/auth.js')

await initDatabase()

const cols = await query(`PRAGMA table_info(users)`)
console.log('users columns:', cols.map(c => c.name))

const now = new Date().toISOString()
const h = await hashPassword('test123')
const id = 'debug-' + Date.now()

try {
  await run(
    `INSERT INTO users (id,email,password_hash,name,role,customer_type,phone,organization_name,address,is_active,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`,
    [id, `dbg${Date.now()}@t.com`, h, 'Test', 'USER', 'PHARMACY', null, null, null, now, now]
  )
  console.log('OK')
} catch (e) {
  console.error('FAIL:', e.message)
}
