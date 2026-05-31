'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { SPDashboard } from '@/lib/types'

const SP_LINKS = [
  { href: '/sp/dashboard', label: 'Dashboard' },
  { href: '/sp/orders', label: 'Orders' },
  { href: '/sp/customers', label: 'My Customers' },
  { href: '/sp/commissions', label: 'Commissions' },
  { href: '/sp/place-order', label: 'Place Order' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-blue-100 text-blue-700',
  DISPATCHED: 'bg-indigo-100 text-indigo-700', DELIVERED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-red-100 text-red-700',
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

export default function SPDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<SPDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      dashboardApi.get().then(setData).catch(console.error).finally(() => setLoading(false))
    }
  }, [user])

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={SP_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Sales Person Dashboard</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Sales" value={`₹${Number(data.totalSales).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-green-600" />
              <StatCard label="Earned Commission" value={`₹${Number(data.earnedCommission).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-blue-600" />
              <StatCard label="Pending Commission" value={`₹${Number(data.pendingCommission).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-orange-600" />
              <StatCard label="My Customers" value={data.myCustomers} color="text-gray-800" />
              <StatCard label="Total Orders" value={data.myOrders} color="text-gray-800" />
              <StatCard label="Pending Deliveries" value={data.pendingDeliveries} color="text-red-500" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Recent Orders</h2>
                  <Link href="/sp/orders" className="text-sm text-blue-600 hover:underline">View all</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentOrders.length === 0 ? (
                    <p className="p-5 text-sm text-gray-400">No orders yet</p>
                  ) : data.recentOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{o.orderNumber}</p>
                        <p className="text-xs text-gray-500">{o.userName || 'Unknown'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  {[
                    { href: '/sp/place-order', label: '🛒 Place Order for Customer', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                    { href: '/sp/customers/new', label: '👤 Register New Customer', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
                    { href: '/sp/orders', label: '📋 Manage Deliveries', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
                    { href: '/sp/commissions', label: '💰 View Commissions', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
                  ].map(a => (
                    <Link key={a.href} href={a.href}
                      className={`block px-4 py-3 rounded-lg text-sm font-medium transition ${a.color}`}>
                      {a.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
