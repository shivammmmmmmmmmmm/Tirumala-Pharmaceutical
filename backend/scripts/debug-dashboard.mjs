import 'dotenv/config'
process.env.DB_DRIVER = 'sqlite'

const { initDatabase, query } = await import('../src/db/index.ts')
await initDatabase()

const tables = await query(`SELECT name FROM sqlite_master WHERE type='table'`)
console.log('tables:', tables.map(t => t.name).join(', '))

try {
  await query("SELECT COUNT(*) as c FROM orders WHERE status='PENDING'")
  console.log('orders OK')
} catch (e) {
  console.error('orders FAIL:', e.message)
}

try {
  await query('SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE status="PENDING"')
  console.log('commissions OK')
} catch (e) {
  console.error('commissions FAIL:', e.message)
}
