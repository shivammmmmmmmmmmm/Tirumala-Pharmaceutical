import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryOne, run } from '../db/index.js'
import { hashPassword, verifyPassword, generateToken } from '../utils/auth.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import type { LoginRequest, RegisterRequest, ApiResponse, LoginResponse } from '../types.js'

const router: Router = Router()

const ACCOUNT_ROLES = ['ADMINISTRATOR', 'DISTRIBUTOR', 'HOSPITAL', 'CLINIC', 'PHARMACY'] as const

function now() {
  return new Date().toISOString()
}

export function formatUser(u: Record<string, unknown>) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    customerType: u.customer_type ?? null,
    phone: u.phone ?? null,
    organizationName: u.organization_name ?? null,
    address: u.address ?? null,
    territory: u.territory ?? null,
    assignedSpId: u.assigned_sp_id ?? null,
    commissionPct: Number(u.commission_pct ?? 0),
    creditLimit: Number(u.credit_limit ?? 0),
    creditUsed: Number(u.credit_used ?? 0),
    isBlocked: Boolean(u.is_blocked),
    isActive: Boolean(u.is_active),
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    lastLogin: u.last_login ?? null,
  }
}

function resolveRegistration(accountRole: string) {
  switch (accountRole) {
    case 'ADMINISTRATOR':
      return { role: 'ADMIN' as const, customerType: null }
    case 'DISTRIBUTOR':
      return { role: 'USER' as const, customerType: 'DISTRIBUTOR' }
    case 'HOSPITAL':
      return { role: 'USER' as const, customerType: 'HOSPITAL' }
    case 'CLINIC':
      return { role: 'USER' as const, customerType: 'CLINIC' }
    case 'PHARMACY':
      return { role: 'USER' as const, customerType: 'PHARMACY' }
    default:
      return null
  }
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, phone, organizationName, address, accountRole } =
      req.body as RegisterRequest

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required',
      } as ApiResponse)
    }
    if (!accountRole || !ACCOUNT_ROLES.includes(accountRole as typeof ACCOUNT_ROLES[number])) {
      return res.status(400).json({ success: false, error: 'Please select a valid role' } as ApiResponse)
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      } as ApiResponse)
    }

    const resolved = resolveRegistration(accountRole)
    if (!resolved) {
      return res.status(400).json({ success: false, error: 'Invalid role' } as ApiResponse)
    }

    if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ success: false, error: 'Email already registered' } as ApiResponse)
    }

    const id = uuidv4()
    const passwordHash = await hashPassword(password)
    const ts = now()
    const creditLimit = resolved.role === 'USER' ? 50000 : 0

    await run(
      `INSERT INTO users (id,email,password_hash,name,role,customer_type,phone,organization_name,address,
       credit_limit,credit_used,is_active,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        id,
        email,
        passwordHash,
        name,
        resolved.role,
        resolved.customerType,
        phone || null,
        organizationName || null,
        address || null,
        creditLimit,
        0,
        ts,
        ts,
      ]
    )

    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return res.status(500).json({ success: false, error: 'Failed to create account' } as ApiResponse)
    }

    const token = generateToken({
      userId: String(user.id),
      email: String(user.email),
      role: String(user.role),
    })
    return res.status(201).json({
      success: true,
      data: { token, user: formatUser(user) },
    } as ApiResponse)
  } catch (e) {
    console.error('Register error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' } as ApiResponse)
    }

    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE email = ?', [email])
    if (!user) return res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse)
    if (!user.is_active) return res.status(403).json({ success: false, error: 'Account deactivated' } as ApiResponse)
    if (user.is_blocked) {
      return res.status(403).json({ success: false, error: 'Account blocked. Contact admin.' } as ApiResponse)
    }
    if (!(await verifyPassword(password, String(user.password_hash)))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' } as ApiResponse)
    }

    await run('UPDATE users SET last_login = ? WHERE id = ?', [now(), user.id])
    const token = generateToken({
      userId: String(user.id),
      email: String(user.email),
      role: String(user.role),
    })
    return res.status(200).json({
      success: true,
      data: { token, user: formatUser(user) },
    } as ApiResponse)
  } catch (e) {
    console.error('Login error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [
      req.user!.userId,
    ])
    if (!user) return res.status(404).json({ success: false, error: 'User not found' } as ApiResponse)
    return res.status(200).json({ success: true, data: formatUser(user) } as ApiResponse)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

export default router
