import 'dotenv/config'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql')

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  multipleStatements: true,
}

async function main() {
  const sql = fs.readFileSync(schemaPath, 'utf8')
  const conn = await mysql.createConnection(config)
  await conn.query(sql)
  await conn.end()
  console.log('✅ Database schema applied. Start the API with: npm run dev')
}

main().catch(err => {
  console.error('❌ Setup failed. Is MySQL running in XAMPP?')
  console.error(err.message)
  process.exit(1)
})
