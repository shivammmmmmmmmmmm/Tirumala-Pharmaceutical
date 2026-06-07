'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { ordersApi, invoicesApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import { Spinner } from '@/components/Loader'
import ReceiptConfirmDialog from '@/components/ReceiptConfirmDialog'
import type { Order } from '@/lib/types'

const STATUS_PILL: Record<string, string> = {
  PENDING:    'badge-pending',
  APPROVED:   'badge-approved',
  DISPATCHED: 'badge-dispatched',
  DELIVERED:  'badge-delivered',
  COMPLETED:  'badge-completed',
  CANCELLED:  'badge-cancelled',
}

const STATUS_ICON: Record<string, string> = {
  PENDING: '⏳', APPROVED: '✅', DISPATCHED: '🚚',
  DELIVERED: '📬', COMPLETED: '🎉', CANCELLED: '❌',
}

const STATUSES = ['', 'PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED']

export default function UserOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders]   = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null)
  const [confirmOrderSpPhone, setConfirmOrderSpPhone] = useState<string | null>(null)
  const [confirmOrderSpName, setConfirmOrderSpName] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersApi.list({ status: statusFilter || undefined, pageSize: 50 } as any)
      setOrders(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { if (user?.role === 'USER') fetchOrders() }, [user, fetchOrders])
  usePolling(fetchOrders, 15000, user?.role === 'USER')

  const downloadInvoice = async (orderId: string) => {
    setDownloading(orderId)
    try {
      const inv = await invoicesApi.get(orderId)
      const w = window.open('', '_blank')
      if (!w) return
      const items = inv.order.items?.map((i: any) =>
        `<tr><td style="padding:8px;border:1px solid #e2e8f0">${i.productName}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center">${i.quantity}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:right">₹${i.unitPrice}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:right">₹${i.totalPrice}</td></tr>`
      ).join('') || ''
      w.document.write(`<!DOCTYPE html><html><head><title>${inv.invoiceNumber}</title><style>body{font-family:sans-serif;color:#1e293b;max-width:600px;margin:40px auto;padding:0 20px}</style></head><body>
        <h2 style="color:#2563eb">Tax Invoice</h2>
        <p><strong>${inv.invoiceNumber}</strong> · ${new Date(inv.issuedAt).toLocaleString('en-IN')}</p>
        <p>Buyer: <strong>${inv.buyer.name}</strong> (${inv.buyer.organization || ''})</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f1f5f9"><th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Item</th><th style="padding:8px;border:1px solid #e2e8f0">Qty</th><th style="padding:8px;border:1px solid #e2e8f0">Rate</th><th style="padding:8px;border:1px solid #e2e8f0">Total</th></tr></thead><tbody>${items}</tbody></table>
        <p>GST (12%): ₹${inv.totals.gstAmount ?? 0}</p>
        <p style="font-size:18px;font-weight:bold">Total: ₹${inv.totals.total}</p>
        <p>Paid: ₹${inv.totals.paid} · Due: ₹${inv.totals.due}</p>
      </body></html>`)
      w.document.close(); w.print()
    } catch(e) { console.error(e) }
    finally { setDownloading(null) }
  }

  if (authLoading || !user || user.role !== 'USER') return null

  // Orders awaiting customer response (both old flow and new flow)
  const awaiting = orders.filter(o => 
    o.receiptStatus === 'AWAITING_CUSTOMER' || 
    o.customerDeliveryStatus === 'AWAITING_RESPONSE'
  )

  return (
    <div className="space-y-5 pb-2">
      {confirmOrderId && (
        <ReceiptConfirmDialog
          orderId={confirmOrderId}
          onClose={() => setConfirmOrderId(null)}
          onDone={() => { setConfirmOrderId(null); fetchOrders() }}
        />
      )}

      {awaiting.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="font-semibold text-amber-900 text-sm">📬 Confirm delivery receipt</p>
          {awaiting.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 border border-amber-100">
              <span className="text-sm font-medium text-slate-800">{o.orderNumber}</span>
              <button type="button" onClick={() => setConfirmOrderId(o.id)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">
                Confirm Receipt
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="text-xs text-slate-400 mt-0.5">Auto-refreshes every 15s</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-base !w-auto">
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">📭</span>
          <p className="font-semibold text-slate-600">No orders found</p>
          <p className="text-sm text-slate-400 mt-1">
            {statusFilter ? `No ${statusFilter.toLowerCase()} orders` : 'You haven\'t placed any orders yet'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <ul className="space-y-3 lg:hidden">
            {orders.map(o => (
              <li key={o.id} className="card-hover bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{o.orderNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>
                    {STATUS_ICON[o.status]} {o.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-xs text-slate-400">Amount</p>
                    <p className="font-bold text-slate-900">₹{Number(o.totalAmount).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Payment</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${o.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {o.paymentStatus}
                    </span>
                  </div>
                  <button type="button" onClick={() => downloadInvoice(o.id)} disabled={downloading === o.id}
                    className="btn-press flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-all">
                    {downloading === o.id ? <Spinner className="h-3 w-3" /> : '📄'}
                    Invoice
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {['Order #', 'Date', 'Status', 'Payment', 'Amount', 'Invoice'].map(h => (
                    <th key={h} className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500 ${h === 'Amount' || h === 'Invoice' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-800">{o.orderNumber}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${o.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      ₹{Number(o.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => downloadInvoice(o.id)} disabled={downloading === o.id}
                        className="btn-press inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-all">
                        {downloading === o.id ? <Spinner className="h-3 w-3" /> : null}
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
