'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { usePolling } from '@/hooks/use-polling'
import type { UserDashboard, Order } from '@/lib/types'

const USER_LINKS = [
  { href: '/user/dashboard', label: 'Dashboard' },
  { href: '/user/products', label: 'Browse Products' },
  { href: '/user/orders', label: 'My Orders' },
  { href: '/user/ledger', label: 'Ledger' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-blue-100 text-blue-700',
  DISPATCHED: 'bg-indigo-100 text-indigo-700', DELIVERED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-red-100 text-red-700',
}

export default function UserDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<UserDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  const loadDashboard = () => {
    dashboardApi.get().then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role === 'USER') loadDashboard()
  }, [user])

  usePolling(() => {
    if (user?.role === 'USER') dashboardApi.get().then(setData).catch(console.error)
  }, 15000, user?.role === 'USER')

  if (authLoading || !user || user.role !== 'USER') return null

  const creditPct = data ? Math.min(100, ((data.creditUsed / (data.creditLimit || 1)) * 100)) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={USER_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
          {user.organizationName && <p className="text-gray-500 text-sm mt-1">{user.organizationName}</p>}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : data ? (
          <>
            {/* Credit Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
              <p className="text-blue-100 text-sm font-medium">Credit Account</p>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <p className="text-3xl font-bold">₹{Number(data.availableCredit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-blue-200 text-sm mt-1">Available Credit</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">₹{Number(data.creditLimit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-blue-200 text-xs">Total Limit</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-blue-200 mb-1">
                  <span>Used: ₹{Number(data.creditUsed).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span>{creditPct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-blue-500/50 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${creditPct}%` }} />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-gray-900">{data.myOrders}</p>
                <p className="text-xs text-gray-500 mt-1">Total Orders</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-green-600">₹{Number(data.totalSpent).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-500 mt-1">Total Spent</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-red-600">₹{Number(data.outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-500 mt-1">Outstanding</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Orders */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Recent Orders</h2>
                  <Link href="/user/orders" className="text-sm text-blue-600 hover:underline">View all</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentOrders.length === 0 ? (
                    <p className="p-5 text-sm text-gray-400">No orders yet</p>
                  ) : data.recentOrders.map((o: Order) => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{o.orderNumber}</p>
                        <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span>
                        <p className="text-xs text-gray-500 mt-1">₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  {[
                    { href: '/user/products', label: '🔍 Browse & Order Products', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                    { href: '/user/orders', label: '📦 Track My Orders', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
                    { href: '/user/ledger', label: '📒 View Ledger & Invoices', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
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
