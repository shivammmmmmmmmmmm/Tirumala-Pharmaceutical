import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryOne, run } from '../db/index.js'
import { hashPassword, verifyPassword, generateToken } from '../utils/auth.js'
import { saveBase64Upload } from '../utils/save-upload.js'
import { logAudit } from '../utils/audit.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import type { LoginRequest, RegisterRequest, ApiResponse, LoginResponse } from '../types.js'

const router: Router = Router()

const ACCOUNT_ROLES = ['ADMINISTRATOR', 'SALES_PERSON', 'DISTRIBUTOR', 'HOSPITAL', 'CLINIC', 'PHARMACY'] as const

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
    approvalStatus: (u.approval_status as string) || 'APPROVED',
    areaId: u.area_id ?? null,
    aadhaarUrl: u.aadhaar_url ?? null,
    photoUrl: u.photo_url ?? null,
    bankAccount: u.bank_account ?? null,
    bankIfsc: u.bank_ifsc ?? null,
    bankName: u.bank_name ?? null,
    spReferralCode: u.sp_referral_code ?? null,
    billingAddress: u.billing_address ?? null,
    shippingAddress: u.shipping_address ?? null,
    latitude: u.latitude != null ? Number(u.latitude) : null,
    longitude: u.longitude != null ? Number(u.longitude) : null,
    referredBySpCode: u.referred_by_sp_code ?? null,
    rejectionRemark: u.rejection_remark ?? null,
    spCommissionPct: u.sp_commission_pct != null ? Number(u.sp_commission_pct) : null,
    spCommissionType: (u.sp_commission_type as string) || 'PERCENTAGE',
    spCommissionValue: u.sp_commission_value != null
      ? Number(u.sp_commission_value)
      : (u.sp_commission_pct != null ? Number(u.sp_commission_pct) : null),
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
    case 'SALES_PERSON':
      return { role: 'SALES_PERSON' as const, customerType: null }
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
    const needsApproval = resolved.role === 'USER'
    const isActive = needsApproval ? 0 : 1
    const approvalStatus = needsApproval ? 'PENDING' : 'APPROVED'

    await run(
      `INSERT INTO users (id,email,password_hash,name,role,customer_type,phone,organization_name,address,
       credit_limit,credit_used,is_active,approval_status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        isActive,
        approvalStatus,
        ts,
        ts,
      ]
    )

    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return res.status(500).json({ success: false, error: 'Failed to create account' } as ApiResponse)
    }

    const docs = (req.body as { documents?: { docType: string; dataUrl: string; fileName?: string }[] }).documents
    if (Array.isArray(docs)) {
      for (const d of docs) {
        if (d.dataUrl && d.docType) {
          const url = await saveBase64Upload(id, d.docType, d.dataUrl, d.fileName)
          if (url && d.docType === 'license') {
            await run('UPDATE users SET updated_at=? WHERE id=?', [now(), id])
          }
        }
      }
    }

    if (needsApproval) {
      return res.status(201).json({
        success: true,
        data: {
          pendingApproval: true,
          message: 'Registration submitted. An administrator will approve your account before you can log in.',
          user: formatUser(user),
        },
      } as ApiResponse)
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
    if (user.approval_status === 'PENDING' || (!user.is_active && user.approval_status !== 'REJECTED')) {
      return res.status(403).json({
        success: false,
        error: 'Account pending admin approval. You will be notified once approved.',
      } as ApiResponse)
    }
    if (user.approval_status === 'REJECTED') {
      return res.status(403).json({ success: false, error: 'Registration was rejected. Contact support.' } as ApiResponse)
    }
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

// ── OAuth Login (called by NextAuth after Google/Facebook callback) ──────────
router.post('/oauth-login', async (req: AuthRequest, res: Response) => {
  try {
    const { provider, providerAccountId, email, name, image } = req.body as {
      provider: string
      providerAccountId: string
      email?: string
      name?: string
      image?: string
    }

    if (!provider || !providerAccountId) {
      return res.status(400).json({ success: false, error: 'provider and providerAccountId required' })
    }

    // Try to find existing user by provider account id first, then by email
    let user = await queryOne<Record<string, unknown>>(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ?',
      [provider, providerAccountId]
    )

    if (!user && email) {
      user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE email = ?', [email])
    }

    const ts = now()

    if (!user) {
      // Create a new user from OAuth
      const id = uuidv4()
      const derivedEmail = email || `${provider}.${providerAccountId}@oauth.local`
      const derivedName = name || 'OAuth User'

      await run(
        `INSERT INTO users
          (id, email, password_hash, name, role, customer_type, is_active, approval_status,
           oauth_provider, oauth_provider_id, photo_url, credit_limit, credit_used, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          derivedEmail,
          '',          // no password for OAuth users
          derivedName,
          'USER',
          null,
          1,           // active immediately for OAuth users
          'APPROVED',
          provider,
          providerAccountId,
          image || null,
          0,
          0,
          ts,
          ts,
        ]
      )
      user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id])
    } else {
      // Update provider info if missing and refresh last login
      await run(
        `UPDATE users SET last_login = ?, oauth_provider = ?, oauth_provider_id = ?,
          photo_url = COALESCE(photo_url, ?), updated_at = ? WHERE id = ?`,
        [ts, provider, providerAccountId, image || null, ts, user.id]
      )
      user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [user.id])
    }

    if (!user) {
      return res.status(500).json({ success: false, error: 'Failed to upsert OAuth user' })
    }
    if (user.is_blocked) {
      return res.status(403).json({ success: false, error: 'Account blocked. Contact admin.' })
    }

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
    console.error('OAuth login error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse)
  }
})

export default router
