'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { productsApi, usersApi, ordersApi } from '@/lib/api'
import { Spinner } from '@/components/Loader'
import OrderSuccessPopup from '@/components/OrderSuccessPopup'
import PaymentDetails from '@/components/PaymentDetails'
import type { Product, User, CartItem } from '@/lib/types'
import { getImageUrl } from '@/lib/image-utils'

const PAYMENT_OPTIONS = [
  { value: 'CREDIT', label: 'Credit', icon: '🏦' },
  { value: 'CASH',   label: 'COD',   icon: '💵' },
  { value: 'UPI',    label: 'UPI',    icon: '📱' },
  { value: 'BANK_TRANSFER', label: 'Bank', icon: '🏧' },
]

export default function SPPlaceOrderPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customers, setCustomers]           = useState<User[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null)
  const [products, setProducts]             = useState<Product[]>([])
  const [allProducts, setAllProducts]       = useState<Product[]>([])
  const [search, setSearch]                 = useState('')
  const [searching, setSearching]           = useState(false)
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod]   = useState('CREDIT')
  const [notes, setNotes]                   = useState('')
  const [placing, setPlacing]               = useState(false)
  const [error, setError]                   = useState('')
  const [successOrder, setSuccessOrder]     = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 🆕 Payment proof states
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null)
  const [paymentFileName, setPaymentFileName] = useState<string>('payment.jpg')
  const [codMentioned, setCodMentioned] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  // Load customers and all products in parallel on mount
  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      Promise.all([
        usersApi.list({ role: 'USER' }),
        productsApi.list({ pageSize: 50 }),
      ]).then(([cRes, pRes]) => {
        setCustomers(cRes.data)
        setAllProducts(pRes.data)
      }).catch(console.error)
    }
  }, [user])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.length < 2) { setProducts([]); setSearching(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await productsApi.list({ search, pageSize: 20 })
        setProducts(res.data)
      } catch (e) { console.error(e) }
      finally { setSearching(false) }
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id)
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1 }]
    })
    setSearch(''); setProducts([])
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product.id !== productId))
    else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  }

  const total = cart.reduce((s, i) => s + i.product.sellingPrice * i.quantity * (1 - i.product.discountPct / 100), 0)

  // 🆕 Convert file to base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  // 🆕 Handle payment screenshot upload
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPaymentFileName(file.name)
    const base64 = await toBase64(file)
    setPaymentScreenshot(base64)
  }

  // 🆕 Reset proof when payment method changes
  useEffect(() => {
    setPaymentScreenshot(null)
    setPaymentFileName('payment.jpg')
    setCodMentioned(false)
  }, [paymentMethod])

  // 🆕 Check if order can be placed
  const canPlace = selectedCustomer && cart.length > 0 && !placing && (
    paymentMethod === 'CASH' ? codMentioned : !!paymentScreenshot
  )

  const placeOrder = async () => {
    if (!selectedCustomer) { setError('Select a customer'); return }
    if (cart.length === 0) { setError('Add at least one product'); return }
    if (paymentMethod !== 'CASH' && !paymentScreenshot) {
      setError('Please attach payment screenshot for ' + PAYMENT_OPTIONS.find(o => o.value === paymentMethod)?.label)
      return
    }
    if (paymentMethod === 'CASH' && !codMentioned) {
      setError('Please confirm COD by checking the checkbox')
      return
    }
    setError(''); setPlacing(true)
    try {
      const order = await ordersApi.create({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod, notes, targetUserId: selectedCustomer.id,
      })
      // 🆕 Upload payment proof after order creation
      if (paymentScreenshot) {
        await ordersApi.uploadPaymentProof(order.id, paymentScreenshot, paymentFileName)
      }
      // 🆕 If COD, add a note to the order
      if (paymentMethod === 'CASH') {
        await ordersApi.updateStatus(order.id, 'PENDING')
      }
      setCart([]); setSelectedCustomer(null); setNotes('')
      setPaymentScreenshot(null); setCodMentioned(false)
      setSuccessOrder(order.orderNumber)
    } catch (e: any) { setError(e.message) }
    finally { setPlacing(false) }
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="pb-4">
      {successOrder && (
        <OrderSuccessPopup
          orderNumber={successOrder}
          onClose={() => { setSuccessOrder(null); router.push('/sp/orders') }}
        />
      )}
      <h1 className="text-2xl font-bold text-slate-900 mb-5">Place Order</h1>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {/* Desktop: side-by-side layout */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Left: inputs */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-slate-800 mb-3">1. Select Customer</p>
            <select value={selectedCustomer?.id || ''} onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
              className="select-base">
              <option value="">Choose a customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.organizationName || c.email}</option>)}
            </select>
            {selectedCustomer && (
              <div className="mt-3 flex items-start justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-emerald-800">{selectedCustomer.name}</p>
                  {selectedCustomer.organizationName && <p className="text-xs text-emerald-600">{selectedCustomer.organizationName}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-600">Available Credit</p>
                  <p className="font-bold text-emerald-700">
                    ₹{((selectedCustomer.creditLimit || 0) - (selectedCustomer.creditUsed || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Product search */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-slate-800 mb-3">2. Add Products</p>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                {searching ? <Spinner className="h-4 w-4 text-blue-500" /> : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products… (or scroll below)"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all" />
              {search && (
                <button onClick={() => { setSearch(''); setProducts([]) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Product list: search results OR full catalogue */}
            {(() => {
              const displayList = search.length >= 2 ? products : allProducts
              const isEmpty = displayList.length === 0
              return (
                <div className="mt-3">
                  {search.length >= 2 && isEmpty && !searching && (
                    <p className="text-sm text-slate-400 text-center py-4">No products found for &ldquo;{search}&rdquo;</p>
                  )}
                  {!isEmpty && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                        {search.length >= 2 ? `${products.length} results` : `All products (${allProducts.length})`}
                      </p>
                      <ul className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-64 overflow-y-auto shadow-sm">
                        {displayList.map(p => (
                          <li key={p.id}>
                            <button type="button" onClick={() => addToCart(p)}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50/60 transition-colors group flex items-center justify-between">
                              <div className="flex-1 min-w-0 pr-3">
                                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 truncate">{p.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {[p.companyName, p.strength, p.category].filter(Boolean).join(' · ')} · Stock: {p.quantity}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-bold text-emerald-600">₹{p.sellingPrice}</span>
                                <span className="h-6 w-6 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all font-bold text-sm">+</span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Payment & Notes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-slate-800 mb-3">3. Payment</p>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setPaymentMethod(opt.value)}
                  className={`btn-press flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                    paymentMethod === opt.value
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400/30'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <span className="text-lg">{opt.icon}</span>
                  <span className={`text-[10px] font-bold ${paymentMethod === opt.value ? 'text-blue-700' : 'text-slate-600'}`}>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* 🆕 Payment proof section */}
            <div className="mt-3">
              {paymentMethod === 'CASH' ? (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <input type="checkbox" id="codConfirm" checked={codMentioned}
                    onChange={e => setCodMentioned(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                  <label htmlFor="codConfirm" className="text-sm text-amber-800">
                    <span className="font-semibold">COD Mentioned</span>
                    <p className="text-xs text-amber-600 mt-0.5">Confirm that this order will be paid as Cash on Delivery</p>
                  </label>
                </div>
              ) : paymentMethod !== 'CREDIT' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                    Attach Payment Screenshot {paymentMethod === 'BANK_TRANSFER' ? '(Bank Transfer)' : '(UPI)'}
                  </p>
                  <input type="file" accept="image/*" onChange={handleScreenshotUpload}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  {paymentScreenshot && (
                    <p className="text-xs text-emerald-600 font-medium">✅ Screenshot attached: {paymentFileName}</p>
                  )}
                  <p className="text-[10px] text-blue-500">Upload screenshot of payment as proof</p>
                </div>
              ) : paymentMethod === 'CREDIT' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-xs font-semibold text-purple-700">🏦 Credit payment — no proof needed</p>
                  <p className="text-xs text-purple-500 mt-0.5">Amount will be deducted from customer's credit limit</p>
                </div>
              )}
            </div>

            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
              className="mt-3 input-base resize-none" rows={2} />
            <PaymentDetails method={paymentMethod} />
          </div>
        </div>

        {/* Right: Cart + Place Order */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit lg:sticky lg:top-20">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-slate-800">Cart</p>
            <span className="text-xs font-semibold text-slate-400">{cart.reduce((s,i)=>s+i.quantity,0)} items</span>
          </div>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="text-4xl mb-3">🛒</span>
              <p className="text-sm text-slate-400">Search and add products above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</p>
                    <p className="text-xs text-slate-400">₹{item.product.sellingPrice} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product.id, item.quantity - 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all btn-press">−</button>
                    <span className="w-7 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, item.quantity + 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all btn-press">+</button>
                  </div>
                  <span className="w-16 text-right text-sm font-bold text-slate-700">
                    ₹{(item.product.sellingPrice * item.quantity * (1 - item.product.discountPct / 100)).toFixed(0)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-xl font-bold text-slate-900">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* 🆕 Payment Status Summary */}
              <div className={`p-3 rounded-xl text-xs ${
                paymentMethod === 'CASH'
                  ? codMentioned ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  : paymentMethod !== 'CREDIT'
                    ? paymentScreenshot ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                <span className="font-semibold">
                  {paymentMethod === 'CASH'
                    ? codMentioned ? '✅ COD confirmed' : '⚠️ Please confirm COD'
                    : paymentMethod === 'CREDIT'
                      ? '🏦 Payment via Credit'
                      : paymentScreenshot ? '✅ Payment screenshot attached' : '⚠️ Attach payment screenshot'}
                </span>
              </div>

              <button onClick={placeOrder} disabled={!canPlace}
                className={`btn-press w-full py-3.5 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  canPlace
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-blue-500/25'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}>
                {placing && <Spinner className="h-4 w-4 text-white" />}
                {placing ? 'Placing…' : !selectedCustomer ? 'Select a customer first' : cart.length === 0 ? 'Add products to cart' : 'Place Order'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}