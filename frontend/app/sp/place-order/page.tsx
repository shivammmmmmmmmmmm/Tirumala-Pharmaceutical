'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { productsApi, usersApi, ordersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { Product, User, CartItem } from '@/lib/types'

const SP_LINKS = [
  { href: '/sp/dashboard', label: 'Dashboard' },
  { href: '/sp/orders', label: 'Orders' },
  { href: '/sp/customers', label: 'My Customers' },
  { href: '/sp/commissions', label: 'Commissions' },
  { href: '/sp/place-order', label: 'Place Order' },
]

export default function SPPlaceOrderPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<User[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('CREDIT')
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      usersApi.list({ role: 'USER' }).then(res => setCustomers(res.data)).catch(console.error)
    }
  }, [user])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.length < 2) { setProducts([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productsApi.list({ search, pageSize: 10 })
        setProducts(res.data)
      } catch (e) { console.error(e) }
    }, 300)
  }, [search])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1 }]
    })
    setSearch(''); setProducts([])
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product.id !== productId))
    else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  }

  const total = cart.reduce((s, i) => s + i.product.sellingPrice * i.quantity * (1 - i.product.discountPct / 100), 0)

  const placeOrder = async () => {
    if (!selectedCustomer) { setError('Select a customer'); return }
    if (cart.length === 0) { setError('Add at least one product'); return }
    setError(''); setPlacing(true)
    try {
      await ordersApi.create({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod, notes, targetUserId: selectedCustomer.id,
      })
      setCart([]); setSelectedCustomer(null); setNotes('')
      router.push('/sp/orders')
    } catch (e: any) { setError(e.message) } finally { setPlacing(false) }
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={SP_LINKS} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Place Order</h1>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-5">
            {/* Customer Select */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Select Customer</h2>
              <select value={selectedCustomer?.id || ''} onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Choose customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.organizationName || c.email}</option>)}
              </select>
              {selectedCustomer && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs">
                  <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-blue-700">Available Credit: ₹{((selectedCustomer.creditLimit||0) - (selectedCustomer.creditUsed||0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
              )}
            </div>

            {/* Product Search */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Search Products</h2>
              <div className="relative">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Type 2+ chars to search…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {products.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                    {products.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition">
                        <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-500">{p.strength} · {p.category}</span>
                          <span className="text-xs font-medium text-green-700">₹{p.sellingPrice}</span>
                          <span className="text-xs text-gray-400">Stock: {p.quantity}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Payment Method</h2>
              <div className="grid grid-cols-2 gap-2">
                {['CREDIT', 'CASH', 'UPI', 'BANK_TRANSFER'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`py-2 text-sm font-medium rounded-lg border transition ${paymentMethod === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-fit">
            <h2 className="font-semibold text-gray-900 mb-3">Cart ({cart.length} items)</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Search and add products</p>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500">₹{item.product.sellingPrice} × {item.quantity} = ₹{(item.product.sellingPrice * item.quantity * (1 - item.product.discountPct / 100)).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded text-sm hover:bg-gray-50">−</button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded text-sm hover:bg-gray-50">+</button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-sm font-bold text-gray-900">
                    <span>Total</span>
                    <span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <button onClick={placeOrder} disabled={placing}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition text-sm">
                  {placing ? 'Placing Order…' : 'Place Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
