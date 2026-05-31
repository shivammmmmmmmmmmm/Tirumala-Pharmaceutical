import type { ApiResponse, PaginatedResponse, User, Product, Order, LedgerEntry, Commission, LoginResponse, LoginRequest, RegisterRequest } from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function token() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

function headers(extra?: Record<string, string>): HeadersInit {
  const t = token()
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra }
}

async function req<T>(method: string, path: string, body?: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  })

  const json: ApiResponse<T> = await res.json()
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`)
  return json.data as T
}


// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (d: LoginRequest) => req<LoginResponse>('POST', '/auth/login', d),
  register: (d: RegisterRequest) => req<LoginResponse>('POST', '/auth/register', d),
  me: () => req<User>('GET', '/auth/me'),
}

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (p?: { search?: string; category?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams()
    if (p?.search) q.set('search', p.search)
    if (p?.category) q.set('category', p.category)
    if (p?.page) q.set('page', String(p.page))
    if (p?.pageSize) q.set('pageSize', String(p.pageSize))
    return req<PaginatedResponse<Product>>('GET', `/products${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<Product>('GET', `/products/${id}`),
  categories: () => req<string[]>('GET', '/products/categories'),
  create: (d: Partial<Product>) => req<Product>('POST', '/products', d),
  update: (id: string, d: Partial<Product>) => req<Product>('PUT', `/products/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/products/${id}`),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (p?: { status?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (p?.status) q.set('status', p.status)
    if (p?.page) q.set('page', String(p.page))
    return req<PaginatedResponse<Order>>('GET', `/orders${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<Order>('GET', `/orders/${id}`),
  create: (d: { items: { productId: string; quantity: number }[]; paymentMethod: string; shippingAddress?: string; notes?: string; targetUserId?: string }) =>
    req<Order>('POST', '/orders', d),
  updateStatus: (id: string, status: string) => req<Order>('PATCH', `/orders/${id}/status`, { status }),
  recordPayment: (id: string, amount: number) => req<Order>('POST', `/orders/${id}/payment`, { amount }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (p?: { role?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (p?.role) q.set('role', p.role)
    if (p?.page) q.set('page', String(p.page))
    return req<PaginatedResponse<User>>('GET', `/users${q.toString() ? `?${q}` : ''}`)
  },
  get: (id: string) => req<User>('GET', `/users/${id}`),
  create: (d: any) => req<User>('POST', '/users', d),
  update: (id: string, d: Partial<User> & { isBlocked?: boolean; isActive?: boolean }) => req<User>('PUT', `/users/${id}`, d),
  setCredit: (id: string, creditLimit: number) => req<User>('PATCH', `/users/${id}/credit`, { creditLimit }),
  ledger: (id: string) => req<LedgerEntry[]>('GET', `/users/${id}/ledger`),
}

// ── Commissions ───────────────────────────────────────────────────────────────
export const commissionsApi = {
  list: () => req<Commission[]>('GET', '/commissions'),
  pay: (id: string) => req<void>('PATCH', `/commissions/${id}/pay`),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => req<any>('GET', '/dashboard'),
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export const pricingApi = {
  list: () => req<PaginatedResponse<any>>('GET', '/pricing'),
  create: (d: any) => req<any>('POST', '/pricing', d),
  update: (id: string, d: any) => req<any>('PUT', `/pricing/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/pricing/${id}`),
}
