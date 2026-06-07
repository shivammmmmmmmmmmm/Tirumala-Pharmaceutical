'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { cartApi, ordersApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import { Spinner } from '@/components/Loader'
import OrderSuccessPopup from '@/components/OrderSuccessPopup'
import PaymentDetails from '@/components/PaymentDetails'

const PAYMENT_OPTIONS = [
  { value: 'CREDIT',        label: 'Credit Account', icon: '🏦', desc: 'Deducted from your credit limit' },
  { value: 'UPI',           label: 'UPI / QR',       icon: '📱', desc: 'Pay via UPI reference' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer',  icon: '🏧', desc: 'NEFT / RTGS / IMPS' },
  { value: 'CASH',          label: 'Cash on Delivery',icon: '💵', desc: 'Pay when delivered' },
]

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems]         = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState('CREDIT')
  const [shippingAddress, setShippingAddress] = useState('')
  const [notes, setNotes]         = useState('')
  const [placing, setPlacing]     = useState(false)
  const [error, setError]         = useState('')
  const [successOrder, setSuccessOrder] = useState<string | null>(null)

  const load = async () => setItems(await cartApi.list())

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
    if (user?.address) setShippingAddress(user.address)
  }, [user, authLoading, router])

  usePolling(load, 8000, user?.role === 'USER')

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity * (1 - i.discountPct / 100), 0)
  const gst      = Math.round(subtotal * 12) / 100
  const total    = subtotal + gst

  const place = async () => {
    if (items.length === 0) return
    setPlacing(true); setError('')
    try {
      const order = await ordersApi.create({ items: items.map(i => ({ productId: i.productId, quantity: i.quantity })), paymentMethod, shippingAddress, notes })
      await cartApi.clear()
      setSuccessOrder(order.orderNumber)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally { setPlacing(false) }
  }

  if (authLoading || !user) return null

  return (
    <div className="max-w-2xl mx-auto pb-4 space-y-5">
      {successOrder && (
        <OrderSuccessPopup
          orderNumber={successOrder}
          onClose={() => { setSuccessOrder(null); router.push('/user/orders') }}
        />
      )}
      <div className="flex items-center gap-3">
        <Link href="/user/products" className="h-9 w-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition btn-press">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5m7-7-7 7 7 7"/></svg>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">🛒</span>
          <p className="font-semibold text-slate-600">Your cart is empty</p>
          <Link href="/user/products" className="mt-4 btn-press px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all">
            Browse Products →
          </Link>
        </div>
      ) : (
        <>
          {/* Order items */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <p className="px-5 py-3.5 font-bold text-slate-800 border-b border-slate-50 text-sm">
              Order Summary ({items.length} items)
            </p>
            <ul className="divide-y divide-slate-50">
              {items.map(i => (
                <li key={i.productId} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{i.name}</p>
                    <p className="text-xs text-slate-400">× {i.quantity} @ ₹{i.unitPrice}</p>
                  </div>
                  <span className="font-bold text-slate-900 text-sm">
                    ₹{(i.unitPrice * i.quantity).toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>GST (12%)</span><span>₹{gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200 mt-1">
                <span>Total</span><span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-slate-800 mb-3">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setPaymentMethod(opt.value)}
                  className={`btn-press flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all duration-150 ${
                    paymentMethod === opt.value
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400/30'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <span className="text-xl mt-0.5">{opt.icon}</span>
                  <div>
                    <p className={`text-xs font-bold ${paymentMethod === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {paymentMethod === 'UPI' && (
              <p className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                📱 Pay via UPI to <strong>merchant@upi</strong> after placing order. Use the order number as reference.
              </p>
            )}
            <PaymentDetails method={paymentMethod} />
          </div>

          {/* Shipping & notes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="font-bold text-slate-800">Delivery Details</p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Shipping Address</label>
              <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)}
                placeholder="Full delivery address…" rows={2} className="input-base resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions…" className="input-base" />
            </div>
          </div>

          <button type="button" onClick={place} disabled={placing}
            className="btn-press w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/25 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 text-base">
            {placing && <Spinner className="h-5 w-5 text-white" />}
            {placing ? 'Placing Order…' : `Place Order · ₹${total.toFixed(2)}`}
          </button>
        </>
      )}
    </div>
  )
}
