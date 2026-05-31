'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { AdminDashboard } from '@/lib/types'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

const EMPTY_DASHBOARD: AdminDashboard = {
  totalUsers: 0,
  totalSPs: 0,
  totalProducts: 0,
  lowStock: 0,
  totalOrders: 0,
  pendingOrders: 0,
  totalRevenue: 0,
  pendingPayments: 0,
  pendingCommissions: 0,
  recentOrders: [],
  topProducts: [],
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  DISPATCHED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AdminDashboard>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role !== 'ADMIN') {
      router.replace(user.role === 'SALES_PERSON' ? '/sp/dashboard' : '/user/dashboard')
    }
  }, [user, authLoading, router])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const stats = await dashboardApi.get()
      setData({
        ...EMPTY_DASHBOARD,
        ...stats,
        recentOrders: stats.recentOrders ?? [],
        topProducts: stats.topProducts ?? [],
      })
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Could not load dashboard. Is the API running on port 3001?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN') loadDashboard()
  }, [user, loadDashboard])

  if (authLoading || !user || user.role !== 'ADMIN') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={ADMIN_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Overview of your distribution business</p>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Refresh
          </button>
        </div>

        {fetchError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Revenue" value={`₹${Number(data.totalRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-green-600" />
              <StatCard label="Pending Payments" value={`₹${Number(data.pendingPayments).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-red-600" />
              <StatCard label="Total Orders" value={data.totalOrders} sub={`${data.pendingOrders} pending`} color="text-blue-600" />
              <StatCard label="Commission Due" value={`₹${Number(data.pendingCommissions).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-orange-600" />
              <StatCard label="Active Users" value={data.totalUsers} color="text-gray-800" />
              <StatCard label="Sales Persons" value={data.totalSPs} color="text-gray-800" />
              <StatCard label="Products" value={data.totalProducts} color="text-gray-800" />
              <StatCard label="Low Stock" value={data.lowStock} sub="need reorder" color="text-red-500" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Recent Orders</h2>
                  <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">View all</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentOrders.length === 0 ? (
                    <p className="p-5 text-sm text-gray-400">No orders yet</p>
                  ) : (
                    data.recentOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{o.orderNumber}</p>
                          <p className="text-xs text-gray-500">{o.userName || 'Unknown'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                            {o.status}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            ₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Top Selling Products</h2>
                  <Link href="/admin/products" className="text-sm text-blue-600 hover:underline">View all</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.topProducts.length === 0 ? (
                    <p className="p-5 text-sm text-gray-400">No sales data yet</p>
                  ) : (
                    data.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        </div>
                        <p className="text-sm text-gray-500">{p.sold} units</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { href: '/admin/products/new', label: 'Add Product', icon: '📦', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
                { href: '/admin/users/new', label: 'Add User', icon: '👤', color: 'bg-green-50 hover:bg-green-100 text-green-700' },
                { href: '/admin/sales-persons/new', label: 'Add Sales Person', icon: '🧑‍💼', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
                { href: '/admin/orders', label: 'Manage Orders', icon: '📋', color: 'bg-orange-50 hover:bg-orange-100 text-orange-700' },
              ].map(a => (
                <Link key={a.href} href={a.href} className={`${a.color} rounded-xl p-4 text-center transition`}>
                  <div className="text-2xl mb-1">{a.icon}</div>
                  <p className="text-sm font-semibold">{a.label}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
