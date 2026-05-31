'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { ordersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { usePolling } from '@/hooks/use-polling'
import type { Order } from '@/lib/types'

const USER_LINKS = [
  { href: '/user/dashboard', label: 'Dashboard' },
  { href: '/user/products', label: 'Browse Products' },
  { href: '/user/orders', label: 'My Orders' },
  { href: '/user/ledger', label: 'Ledger' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  DISPATCHED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function UserOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersApi.list({ status: statusFilter || undefined, pageSize: 50 })
      setOrders(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (user?.role === 'USER') fetchOrders()
  }, [user, fetchOrders])

  usePolling(fetchOrders, 15000, user?.role === 'USER')

  if (authLoading || !user || user.role !== 'USER') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={USER_LINKS} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
            <p className="text-sm text-gray-500 mt-1">Updates every 15 seconds</p>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {['', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No orders yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(o.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || ''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{o.paymentStatus}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₹{Number(o.totalAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
