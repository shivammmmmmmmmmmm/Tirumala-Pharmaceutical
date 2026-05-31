import 'dotenv/config'
process.env.DB_DRIVER = 'sqlite'

const { initDatabase, query } = await import('../src/db/index.ts')
await initDatabase()

const cols = await query('PRAGMA table_info(products)')
console.log('columns:', cols.map(c => c.name).join(', '))

const search = await query(
  `SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR sku LIKE ?) LIMIT 2`,
  ['%para%', '%para%']
)
console.log('search ok:', search[0]?.name, 'price:', search[0]?.selling_price)
