export type UserRole = 'ADMIN' | 'SALES_PERSON' | 'USER'
export type CustomerType = 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC' | 'PHARMACY'
export type AccountRole = 'ADMINISTRATOR' | 'DISTRIBUTOR' | 'HOSPITAL' | 'CLINIC' | 'PHARMACY'
export type OrderStatus = 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CREDIT' | 'UPI' | 'BANK_TRANSFER' | 'CASH'
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID'

export interface User {
  id: string; email: string; name: string; role: UserRole
  customerType?: CustomerType | null
  phone?: string | null; organizationName?: string | null; address?: string | null
  territory?: string | null; assignedSpId?: string | null
  commissionPct?: number; creditLimit?: number; creditUsed?: number
  isBlocked?: boolean; isActive?: boolean
  createdAt?: string; updatedAt?: string; lastLogin?: string | null
}

export interface Product {
  id: string; name: string; companyName?: string; category?: string
  description?: string; ingredients?: string; strength?: string; dosageForm?: string
  mrp: number; sellingPrice: number; discountPct: number; sku: string
  manufacturer?: string; quantity: number; reorderLevel: number
  imageUrl?: string | null; isActive: boolean; createdAt?: string; updatedAt?: string
}

export interface OrderItem {
  id: string; orderId: string; productId: string; productName: string
  quantity: number; unitPrice: number; discountPct: number; totalPrice: number
}

export interface Order {
  id: string; orderNumber: string; userId: string; spId?: string | null
  status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus
  subtotal: number; discountAmount: number; totalAmount: number; paidAmount: number
  notes?: string; shippingAddress?: string; deliveredAt?: string | null
  createdAt: string; updatedAt: string; items?: OrderItem[]
  userName?: string | null; userOrg?: string | null; spName?: string | null
}

export interface LedgerEntry {
  id: string; userId: string; type: 'DEBIT' | 'CREDIT'; amount: number
  balanceAfter: number; description: string; referenceId?: string
  referenceType?: string; createdAt: string
}

export interface Commission {
  id: string; spId: string; orderId: string; orderNumber?: string; spName?: string
  orderAmount: number; commissionPct: number; commissionAmount: number
  status: 'PENDING' | 'APPROVED' | 'PAID'; paidAt?: string | null; createdAt: string
}

export interface ApiResponse<T = any> {
  success: boolean; data?: T; error?: string; message?: string
}
export interface PaginatedResponse<T> {
  data: T[]; total: number; page: number; pageSize: number; totalPages: number
}
export interface LoginRequest { email: string; password: string }
export interface LoginResponse { token: string; user: User }
export interface RegisterRequest {
  email: string; password: string; name: string
  accountRole: AccountRole
  phone?: string; organizationName?: string; address?: string
}

export interface CartItem {
  product: Product; quantity: number
}

export interface AdminDashboard {
  totalUsers: number; totalSPs: number; totalProducts: number; lowStock: number
  totalOrders: number; pendingOrders: number; totalRevenue: number
  pendingPayments: number; pendingCommissions: number
  recentOrders: Order[]; topProducts: { name: string; sold: number }[]
}

export interface SPDashboard {
  myCustomers: number; myOrders: number; pendingDeliveries: number
  totalSales: number; earnedCommission: number; pendingCommission: number
  recentOrders: Order[]
}

export interface UserDashboard {
  myOrders: number; totalSpent: number; outstanding: number
  creditLimit: number; creditUsed: number; availableCredit: number
  recentOrders: Order[]
}
