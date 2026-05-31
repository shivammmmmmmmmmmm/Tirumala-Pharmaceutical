'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { ordersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { Order } from '@/lib/types'

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
const NEXT_STATUS: Record<string, string[]> = {
  APPROVED: ['DISPATCHED'], DISPATCHED: ['DELIVERED'], DELIVERED: ['COMPLETED'],
}

export default function SPOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ordersApi.list({ status: statusFilter || undefined, page })
      setOrders(res.data); setTotal(res.total)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [statusFilter, page])

  useEffect(() => { if (user?.role === 'SALES_PERSON') fetchOrders() }, [user, fetchOrders])

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true)
    try { await ordersApi.updateStatus(id, status); fetchOrders(); setSelected(null) }
    catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  const recordPayment = async (id: string) => {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) { alert('Enter valid amount'); return }
    setUpdating(true)
    try { await ordersApi.recordPayment(id, amt); setPayAmount(''); fetchOrders(); setSelected(null) }
    catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={SP_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].map(s => (
              <option key={s} value={s}>{s || 'All Statuses'}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Order #', 'Customer', 'Amount', 'Payment', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No orders found</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-blue-600">{o.orderNumber}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.userName || '—'}</td>
                    <td className="px-4 py-3 font-medium">₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.paymentStatus}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(o)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-gray-900">Order {selected.orderNumber}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Customer</p><p className="font-medium">{selected.userName}</p></div>
                <div><p className="text-gray-500">Status</p><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status}</span></div>
                <div><p className="text-gray-500">Total</p><p className="font-medium">₹{Number(selected.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
                <div><p className="text-gray-500">Paid</p><p className="font-medium">₹{Number(selected.paidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
              </div>
              {NEXT_STATUS[selected.status] && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Update Status</p>
                  <div className="flex gap-2">
                    {NEXT_STATUS[selected.status].map(s => (
                      <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={updating}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition disabled:opacity-50">→ {s}</button>
                    ))}
                  </div>
                </div>
              )}
              {selected.paymentStatus !== 'PAID' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Collect Payment</p>
                  <div className="flex gap-2">
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      placeholder="Amount (₹)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => recordPayment(selected.id)} disabled={updating}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">Collect</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
