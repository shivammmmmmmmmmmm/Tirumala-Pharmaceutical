'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { ordersApi } from '@/lib/api'
import { Spinner } from '@/components/Loader'
import type { Order } from '@/lib/types'

const STATUS_PILL: Record<string, string> = {
  PENDING: 'badge-pending', APPROVED: 'badge-approved', DISPATCHED: 'badge-dispatched',
  DELIVERED: 'badge-delivered', COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
}
const NEXT_STATUS: Record<string, string[]> = {
  APPROVED: ['DISPATCHED'], DISPATCHED: ['DELIVERED'], DELIVERED: ['COMPLETED'],
}
const STATUSES = ['', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED']

export default function SPOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders]       = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Order | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [updating, setUpdating]   = useState(false)
  const [err, setErr]             = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ordersApi.list({ status: statusFilter || undefined } as any)
      setOrders(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { if (user?.role === 'SALES_PERSON') fetchOrders() }, [user, fetchOrders])

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true); setErr('')
    try { await ordersApi.updateStatus(id, status); fetchOrders(); setSelected(null) }
    catch (e: any) { setErr(e.message) }
    finally { setUpdating(false) }
  }

  const recordPayment = async (id: string) => {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return }
    setUpdating(true); setErr('')
    try { await ordersApi.recordPayment(id, amt); setPayAmount(''); fetchOrders(); setSelected(null) }
    catch (e: any) { setErr(e.message) }
    finally { setUpdating(false) }
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-base !w-auto">
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">📋</span>
          <p className="font-semibold text-slate-600">No orders found</p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <ul className="space-y-3 lg:hidden">
            {orders.map(o => (
              <li key={o.id}>
                <button type="button" onClick={() => { setSelected(o); setErr('') }}
                  className="card-hover w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-blue-600">{o.orderNumber}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{o.userName || '—'}</p>
                      <p className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>{o.status}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-50">
                    <span className="font-bold text-slate-900">₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${o.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {o.paymentStatus}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {['Order #', 'Customer', 'Amount', 'Payment', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4 font-semibold text-blue-600">{o.orderNumber}</td>
                    <td className="px-5 py-4 font-medium text-slate-800">{o.userName || '—'}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${o.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{o.paymentStatus}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <button onClick={() => { setSelected(o); setErr('') }}
                        className="btn-press px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-all">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Manage modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Managing order</p>
                <h2 className="font-bold text-slate-900 text-lg">{selected.orderNumber}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors btn-press">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {err && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{err}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Customer', value: selected.userName || '—' },
                  { label: 'Status',   value: null, badge: selected.status },
                  { label: 'Total',    value: `₹${Number(selected.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                  { label: 'Paid',     value: `₹${Number(selected.paidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                    {item.badge
                      ? <span className={`mt-1 inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_PILL[item.badge] ?? ''}`}>{item.badge}</span>
                      : <p className="font-bold text-slate-800 mt-0.5">{item.value}</p>
                    }
                  </div>
                ))}
              </div>

              {NEXT_STATUS[selected.status] && (
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-2">Update Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {NEXT_STATUS[selected.status].map(s => (
                      <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={updating}
                        className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-blue-500/20">
                        {updating && <Spinner className="h-3.5 w-3.5 text-white" />}
                        Mark {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.paymentStatus !== 'PAID' && (
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-2">Collect Payment</p>
                  <div className="flex gap-2">
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      placeholder="Amount (₹)" className="input-base flex-1" />
                    <button onClick={() => recordPayment(selected.id)} disabled={updating}
                      className="btn-press px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20 flex items-center gap-1.5">
                      {updating && <Spinner className="h-3.5 w-3.5 text-white" />}
                      Collect
                    </button>
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
