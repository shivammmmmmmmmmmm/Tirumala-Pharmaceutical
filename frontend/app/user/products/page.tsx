'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { productsApi, ordersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { Product, CartItem } from '@/lib/types'

const USER_LINKS = [
  { href: '/user/dashboard', label: 'Dashboard' },
  { href: '/user/products', label: 'Browse Products' },
  { href: '/user/orders', label: 'My Orders' },
  { href: '/user/ledger', label: 'Ledger' },
]

export default function UserProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('CREDIT')
  const [shippingAddress, setShippingAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.address) setShippingAddress(user.address)
    else if (user?.organizationName) setShippingAddress(user.organizationName)
  }, [user])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.length < 2) {
      setProducts([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productsApi.list({ search, pageSize: 15 })
        setProducts(res.data)
      } catch (e) {
        console.error(e)
      }
    }, 300)
  }, [search])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setSearch('')
    setProducts([])
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product.id !== productId))
    else setCart(prev => prev.map(i => (i.product.id === productId ? { ...i, quantity: qty } : i)))
  }

  const total = cart.reduce(
    (s, i) => s + i.product.sellingPrice * i.quantity * (1 - i.product.discountPct / 100),
    0
  )

  const placeOrder = async () => {
    if (cart.length === 0) {
      setError('Add at least one product')
      return
    }
    setError('')
    setPlacing(true)
    try {
      await ordersApi.create({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod,
        shippingAddress: shippingAddress || undefined,
        notes: notes || undefined,
      })
      setCart([])
      setNotes('')
      router.push('/user/orders')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Order failed')
    } finally {
      setPlacing(false)
    }
  }

  if (authLoading || !user || user.role !== 'USER') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={USER_LINKS} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Browse & Order Products</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search medicines</label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type at least 2 characters…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {products.length > 0 && (
                <ul className="mt-3 border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {products.map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                      >
                        <span className="font-medium text-gray-900">{p.name}</span>
                        <span className="text-gray-500 ml-2">₹{p.sellingPrice} · Stock: {p.quantity}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="CREDIT">Credit account</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shipping address</label>
                <textarea
                  value={shippingAddress}
                  onChange={e => setShippingAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Your cart</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400">Search and add products to your cart.</p>
            ) : (
              <>
                <ul className="space-y-3 mb-4">
                  {cart.map(i => (
                    <li key={i.product.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-gray-900 flex-1">{i.product.name}</span>
                      <input
                        type="number"
                        min={1}
                        max={i.product.quantity}
                        value={i.quantity}
                        onChange={e => updateQty(i.product.id, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                      <span className="text-gray-600 w-20 text-right">
                        ₹{(i.product.sellingPrice * i.quantity).toFixed(0)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-bold text-gray-900 mb-4">Total: ₹{total.toFixed(2)}</p>
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={placing}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg text-sm"
                >
                  {placing ? 'Placing order…' : 'Place order'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
