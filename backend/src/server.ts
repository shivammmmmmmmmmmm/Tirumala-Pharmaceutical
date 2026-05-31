import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDatabase, getActiveDriver } from './db/index.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import pricingRoutes from './routes/pricing.js'
import orderRoutes from './routes/orders.js'
import userRoutes from './routes/users.js'
import commissionRoutes from './routes/commissions.js'
import dashboardRoutes from './routes/dashboard.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(express.json({ limit: '10mb' }))
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', database: getActiveDriver(), timestamp: new Date().toISOString() })
)

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/pricing', pricingRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/users', userRoutes)
app.use('/api/commissions', commissionRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

async function start() {
  try {
    await initDatabase()
    const server = app.listen(PORT, () => {
      console.log(`\n✅ Medical Distribution API running on port ${PORT}`)
      console.log(`   Health: http://localhost:${PORT}/health\n`)
    })
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} in use. Run: npm run kill-port\n`)
        process.exit(1)
      }
      throw err
    })
    process.on('SIGINT', () => server.close(() => process.exit(0)))
    process.on('SIGTERM', () => server.close(() => process.exit(0)))
  } catch (err) {
    console.error('\n❌ Failed to start server.')
    console.error('   Try: set DB_DRIVER=sqlite in .env  OR  restart MySQL in XAMPP')
    console.error('   Test MySQL: npm run db:test\n')
    console.error(err)
    process.exit(1)
  }
}

start()

export default app
