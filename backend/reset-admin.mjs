import 'dotenv/config'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'medical_db',
}

const hash = await bcrypt.hash('Admin@123', 10)
const conn = await mysql.createConnection(config)
const [result] = await conn.execute(
  "UPDATE users SET password_hash = ? WHERE email = 'admin@medical.com'",
  [hash]
)
await conn.end()

if (result.affectedRows === 0) {
  console.log('⚠️  No admin user found. Start the server once to seed the database.')
} else {
  console.log('✅ Admin password reset to: Admin@123')
  console.log('   Email: admin@medical.com')
}
