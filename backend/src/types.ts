export type UserRole = 'ADMIN' | 'SALES_PERSON' | 'USER'
export type OrderStatus = 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CREDIT' | 'UPI' | 'BANK_TRANSFER' | 'CASH'
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID'

export interface User {
  id: string; email: string; name: string; role: UserRole
  phone?: string; organizationName?: string; address?: string
  territory?: string; assignedSpId?: string; commissionPct?: number
  creditLimit?: number; creditUsed?: number; isBlocked?: boolean
  isActive: boolean; createdAt: string; updatedAt: string; lastLogin?: string
}
export interface Product {
  id: string; name: string; companyName?: string; category?: string
  description?: string; ingredients?: string; strength?: string; dosageForm?: string
  mrp: number; sellingPrice: number; discountPct: number; sku: string
  manufacturer?: string; quantity: number; reorderLevel: number
  imageUrl?: string; isActive: boolean; createdAt: string; updatedAt: string
}
export interface OrderItem {
  id: string; orderId: string; productId: string; productName: string
  quantity: number; unitPrice: number; discountPct: number; totalPrice: number
}
export interface Order {
  id: string; orderNumber: string; userId: string; spId?: string
  status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus
  subtotal: number; discountAmount: number; totalAmount: number; paidAmount: number
  notes?: string; shippingAddress?: string; deliveredAt?: string
  createdAt: string; updatedAt: string; items?: OrderItem[]
}
export interface LedgerEntry {
  id: string; userId: string; type: 'DEBIT' | 'CREDIT'; amount: number
  balanceAfter: number; description: string; referenceId?: string
  referenceType?: string; createdAt: string
}
export interface Commission {
  id: string; spId: string; orderId: string; orderAmount: number
  commissionPct: number; commissionAmount: number
  status: 'PENDING' | 'APPROVED' | 'PAID'; paidAt?: string
  createdAt: string; updatedAt: string
}
export interface ApiResponse<T = any> {
  success: boolean; data?: T; error?: string; message?: string
}
export interface PaginatedResponse<T> {
  data: T[]; total: number; page: number; pageSize: number; totalPages: number
}
export interface LoginRequest { email: string; password: string }
export interface LoginResponse { token: string; user: User }
export type CustomerType = 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC' | 'PHARMACY'
export type AccountRole = 'ADMINISTRATOR' | 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC' | 'PHARMACY'

export interface RegisterRequest {
  email: string; password: string; name: string
  accountRole: AccountRole
  phone?: string; organizationName?: string; address?: string
}
