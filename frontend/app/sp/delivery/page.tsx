'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { ordersApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import { Spinner } from '@/components/Loader'
import ScreenshotView from '@/components/ScreenshotView'
import type { Order } from '@/lib/types'

const STATUS_PILL: Record<string, string> = {
  PENDING: 'badge-warning',
  APPROVED: 'badge-approved',
  DISPATCHED: 'badge-dispatched',
  DELIVERED: 'badge-success',
  COMPLETED: 'badge-success',
}

export default function SPDeliveryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [selectedTracking, setSelectedTracking] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

  // Tracking submission states
  const [trackingCode, setTrackingCode] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [courierScreenshot, setCourierScreenshot] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await ordersApi.list({ pageSize: 50 } as any)
      setOrders(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadTracking = useCallback(async (orderId: string) => {
    setLoadingTracking(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedTracking(data.data)
      }
    } catch (e) { console.error(e) }
    finally { setLoadingTracking(false) }
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 12000, user?.role === 'SALES_PERSON')

  // 🆕 Submit tracking/courier details
  const submitTracking = async () => {
    if (!selected) return
    if (!trackingCode && !courierScreenshot) {
      alert('Please enter a tracking code or upload a courier screenshot')
      return
    }
    setSaving(true)
    try {
      await ordersApi.submitTracking(selected.id, {
        trackingCode: trackingCode || undefined,
        deliveryNotes: deliveryNotes || undefined,
        courierScreenshot: courierScreenshot || undefined,
      })
      alert('✅ Courier details submitted! Customer has been notified to confirm receipt.')
      setSelected(null)
      setTrackingCode('')
      setDeliveryNotes('')
      setCourierScreenshot(null)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to submit tracking details')
    } finally { setSaving(false) }
  }

  // Convert file to base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await toBase64(file)
    setCourierScreenshot(base64)
  }

  // Filter orders by tab
  const pendingOrders = orders.filter(o =>
    o.status === 'DISPATCHED' && !o.trackingCode && !o.deliveryScreenshotUrl
  )
  const completedOrders = orders.filter(o =>
    o.status === 'DELIVERED' || o.status === 'COMPLETED' || o.status === 'CANCELLED' ||
    (o.trackingCode || o.deliveryScreenshotUrl)
  )

  if (authLoading || !user) return null

  return (
    <div className="space-y-5 pb-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📦 Dispatch & Tracking</h1>
        <p className="text-xs text-slate-400 mt-0.5">Collect material → Submit courier details → Customer confirms receipt</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          🚚 To Dispatch ({pendingOrders.length})
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          History ({completedOrders.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : activeTab === 'pending' && pendingOrders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">✅</span>
          <p className="font-semibold text-slate-600">No pending dispatches</p>
          <p className="text-sm text-slate-400 mt-1">Orders ready for dispatch will appear here</p>
        </div>
      ) : activeTab === 'history' && completedOrders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">📋</span>
          <p className="font-semibold text-slate-600">No completed orders yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(activeTab === 'pending' ? pendingOrders : completedOrders).map(o => (
            <li key={o.id}>
              <button type="button"
                onClick={() => {
                  setSelected(o)
                  setTrackingCode(o.trackingCode || '')
                  setDeliveryNotes(o.deliveryNotes || '')
                  setCourierScreenshot(null)
                  loadTracking(o.id)
                }}
                className="card-hover w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{o.orderNumber}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{o.userName || '—'}</p>
                    {o.shippingAddress && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">📍 {o.shippingAddress}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {o.status === 'DISPATCHED' && !o.trackingCode && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                          ⏳ Submit courier details
                        </span>
                      )}
                      {(o.trackingCode || o.deliveryScreenshotUrl) && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                          📬 Courier details sent
                        </span>
                      )}
                      {o.status === 'DELIVERED' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium">
                          ✅ Customer Confirmed
                        </span>
                      )}
                      {o.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
                          🎉 Completed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>
                      {o.status}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => {
            setSelected(null)
            setSelectedTracking(null)
            setTrackingCode('')
            setDeliveryNotes('')
            setCourierScreenshot(null)
          }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <p className="text-xs text-slate-400">Order Details for</p>
                <h2 className="font-bold text-slate-900 text-lg">{selected.orderNumber}</h2>
              </div>
              <button onClick={() => {
                setSelected(null)
                setSelectedTracking(null)
                setTrackingCode('')
                setDeliveryNotes('')
                setCourierScreenshot(null)
              }} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors btn-press">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* TRACKING TIMELINE */}
              {loadingTracking ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6 text-indigo-600" />
                </div>
              ) : selectedTracking && selectedTracking.timeline ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-4">📋 Delivery Timeline</h3>
                  <div className="space-y-3">
                    {selectedTracking.timeline.map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            item.completed
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {item.completed ? '✓' : idx + 1}
                          </div>
                          {idx < selectedTracking.timeline.length - 1 && (
                            <div className={`w-0.5 h-8 ${item.completed ? 'bg-emerald-200' : 'bg-slate-100'}`} />
                          )}
                        </div>
                        <div className="flex-1 py-1">
                          <p className={`text-sm font-semibold ${item.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                            {item.label}
                          </p>
                          {item.timestamp && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(item.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CUSTOMER INFO */}
              {selectedTracking?.customer && (
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Customer</p>
                  <p className="font-semibold text-slate-900">{selectedTracking.customer.name}</p>
                  {selectedTracking.customer.organization && (
                    <p className="text-sm text-slate-600 mt-1">{selectedTracking.customer.organization}</p>
                  )}
                  {selectedTracking.customer.phone && (
                    <p className="text-xs text-slate-500 mt-1">Phone: {selectedTracking.customer.phone}</p>
                  )}
                </div>
              )}

              {/* Already submitted tracking info */}
              {(selected.trackingCode || selected.deliveryScreenshotUrl) && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">✅ Courier Details Submitted</p>
                  {selected.trackingCode && (
                    <p className="text-sm text-slate-800"><span className="font-semibold">Tracking:</span> {selected.trackingCode}</p>
                  )}
                  {selected.deliveryScreenshotUrl && (
                    <ScreenshotView url={selected.deliveryScreenshotUrl} label="View courier screenshot" />
                  )}
                  <p className="text-xs text-slate-500 mt-2">Waiting for customer to confirm receipt</p>
                </div>
              )}

              {/* 🆕 SUBMIT TRACKING - For DISPATCHED orders without tracking */}
              {selected.status === 'DISPATCHED' && !selected.trackingCode && !selected.deliveryScreenshotUrl && (
                <div className="space-y-4">
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                    <p className="font-semibold text-amber-900 text-sm">📬 Submit Courier Details</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Admin has requested dispatch. Collect the material and enter courier/tracking details below.
                    </p>
                  </div>

                  {/* Tracking Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      📦 Tracking / Docket Number
                    </label>
                    <input type="text" value={trackingCode} onChange={e => setTrackingCode(e.target.value)}
                      placeholder="e.g. DHL-1234567890"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>

                  {/* Delivery Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      📝 Delivery Notes (optional)
                    </label>
                    <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>

                  {/* Courier Screenshot Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      📸 Courier Screenshot (optional)
                    </label>
                    <input type="file" accept="image/*" onChange={handleScreenshotUpload}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    {courierScreenshot && (
                      <p className="text-xs text-emerald-600 mt-1">✅ Screenshot selected</p>
                    )}
                  </div>

                  <button type="button" onClick={submitTracking} disabled={saving || (!trackingCode && !courierScreenshot)}
                    className="btn-press w-full flex items-center justify-center gap-1.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-md shadow-indigo-500/25">
                    {saving ? <Spinner className="h-4 w-4 text-white" /> : '📤'}
                    Submit Courier Details
                  </button>
                </div>
              )}

              {/* Customer confirmed receipt */}
              {selected.status === 'DELIVERED' && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">✅ Customer Confirmed Receipt</p>
                  <p className="font-semibold text-slate-900">Order has been delivered successfully!</p>
                  <p className="text-xs text-slate-500 mt-1">Awaiting admin commission release.</p>
                </div>
              )}

              {/* COMPLETED */}
              {selected.status === 'COMPLETED' && (
                <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">🎉 Completed</p>
                  <p className="font-semibold text-slate-900">Order completed successfully!</p>
                  <p className="text-xs text-slate-500 mt-1">Commission has been released.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}