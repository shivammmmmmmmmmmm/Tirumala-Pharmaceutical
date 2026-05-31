import 'dotenv/config'
import mysql from 'mysql2/promise'

const host = process.env.DB_HOST || '127.0.0.1'
const port = Number(process.env.DB_PORT) || 3306
const user = process.env.DB_USER || 'root'
const password = process.env.DB_PASSWORD ?? ''

console.log(`Testing MySQL at ${host}:${port} (user: ${user})...\n`)

try {
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    connectTimeout: 5000,
  })
  const [rows] = await conn.query('SELECT VERSION() AS version')
  await conn.end()
  console.log('✅ MySQL OK —', rows[0].version)
  console.log('\nUse in .env:')
  console.log('  DB_DRIVER=mysql')
  console.log(`  DB_HOST=${host}`)
} catch (err) {
  console.log('❌ MySQL failed —', err.code || err.message)
  console.log('\nFix steps:')
  console.log('  1. Open XAMPP Control Panel')
  console.log('  2. Click Stop on MySQL, wait 5 seconds, click Start')
  console.log('  3. Run this test again: npm run db:test')
  console.log('\nWorkaround (app still runs):')
  console.log('  Add to .env:  DB_DRIVER=sqlite')
  process.exit(1)
}
