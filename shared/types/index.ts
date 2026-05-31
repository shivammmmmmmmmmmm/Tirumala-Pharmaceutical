// User Types
export type UserRole = 'ADMIN' | 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC' | 'PHARMACY'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  organizationName?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Product Types
export interface Product {
  id: string
  name: string
  description: string
  sku: string
  category: string
  manufacturer: string
  quantity: number
  reorderLevel: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ProductPricing {
  id: string
  productId: string
  role: UserRole
  price: number
  minQuantity: number
  maxQuantity?: number
  effectiveFrom: Date
  effectiveTo?: Date
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Auth Types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  role: UserRole
  organizationName?: string
}

// Order Types
export interface OrderItem {
  productId: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  totalAmount: number
  shippingAddress: string
  createdAt: Date
  updatedAt: Date
}

// Audit Log Types
export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  changes?: Record<string, any>
  ipAddress?: string
  timestamp: Date
}
