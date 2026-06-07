'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { ordersApi } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import ScreenshotView from '@/components/ScreenshotView'
import { usePolling } from '@/hooks/use-polling'
import type { Order } from '@/lib/types'

const METHOD_ICONS: Record<string, string> = {
  CREDIT: '🏦', UPI: '📱', BANK_TRANSFER: '🏧', CASH: '💵',
}

export default function UserPaymentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await ordersApi.list({ pageSize: 50 } as any)
      setOrders(res.data.filter(o => o.paymentStatus !== 'PAID'))
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 15000, user?.role === 'USER')

  const uploadProof = async (orderId: string, dataUrl: string) => {
    setUploading(orderId)
    try {
      await ordersApi.uploadPaymentProof(orderId, dataUrl)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  if (authLoading || !user) return null

  const totalDue = orders.reduce((s, o) => s + (o.totalAmount - o.paidAmount), 0)

  return (
    <div className="space-y-5 pb-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-xs text-slate-400 mt-0.5">Outstanding orders — settle with your sales representative</p>
      </div>

      {/* Total due banner */}
      {!loading && orders.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #dc2626 0%, #9f1239 100%)' }}>
          <div className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10" />
          <p className="text-red-200 text-xs font-semibold uppercase tracking-widest">Total Outstanding</p>
          <p className="text-3xl font-bold mt-1">₹{totalDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-red-200 text-xs mt-1">{orders.length} pending payment{orders.length > 1 ? 's' : ''}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">✅</span>
          <p className="font-semibold text-slate-600">All payments cleared</p>
          <p className="text-sm text-slate-400 mt-1">No outstanding dues</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map(o => (
            <li key={o.id} className="card-hover bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-800">{o.orderNumber}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {METHOD_ICONS[o.paymentMethod] || ''} {o.paymentMethod.replace('_', ' ')}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                  {o.paymentStatus}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Total Order</p>
                  <p className="font-semibold text-slate-700">₹{Number(o.totalAmount).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Paid</p>
                  <p className="font-semibold text-emerald-600">₹{Number(o.paidAmount).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Due</p>
                  <p className="font-bold text-red-600 text-lg">
                    ₹{(o.totalAmount - o.paidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (o.paidAmount / o.totalAmount) * 100)}%` }} />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50">
                {o.paymentScreenshotUrl ? (
                  <ScreenshotView url={o.paymentScreenshotUrl} label="✓ View payment screenshot" />
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Attach payment screenshot after UPI/bank transfer</p>
                    <FileUpload
                      label={uploading === o.id ? 'Uploading…' : 'Upload screenshot'}
                      accept="image/*"
                      onFile={(dataUrl) => uploadProof(o.id, dataUrl)}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && orders.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">💡 How to pay</p>
          <p className="text-blue-600 text-xs">Contact your assigned sales representative to settle outstanding dues via UPI, bank transfer, or cash.</p>
        </div>
      )}
    </div>
  )
}
