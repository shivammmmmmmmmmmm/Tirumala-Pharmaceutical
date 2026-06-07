'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { productsApi, cartApi } from '@/lib/api'
import { Spinner } from '@/components/Loader'
import type { Product, CartItem } from '@/lib/types'
import { getImageUrl } from '@/lib/image-utils'

const SEARCH_MODES = [
  { value: 'all',        label: 'Name / SKU' },
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'company',    label: 'Company' },
  { value: 'strength',   label: 'Strength' },
] as const
type SearchMode = typeof SEARCH_MODES[number]['value']

export default function UserProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts]     = useState<Product[]>([])
  const [catalog, setCatalog]       = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [search, setSearch]         = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('all')
  const [searching, setSearching]   = useState(false)
  const [cart, setCart]             = useState<CartItem[]>([])
  const [cartOpen, setCartOpen]     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  // Load full product catalog on mount (for customers to browse)
  useEffect(() => {
    if (user?.role === 'USER') {
      setCatalogLoading(true)
      productsApi.list({ pageSize: 50 })
        .then(res => setCatalog(res.data))
        .catch(console.error)
        .finally(() => setCatalogLoading(false))
    }
  }, [user])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.length < 2) { setProducts([]); setSearching(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const params: Parameters<typeof productsApi.list>[0] = { pageSize: 15 }
        if (searchMode === 'ingredient') params.ingredient = search
        else if (searchMode === 'company') params.company = search
        else if (searchMode === 'strength') params.strength = search
        else params.search = search
        const res = await productsApi.list(params)
        setProducts(res.data)
      } catch (e) { console.error(e) }
      finally { setSearching(false) }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, searchMode])

  const addToCart = (product: Product) => {
    cartApi.add(product.id, 1).catch(() => {})
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

  if (authLoading || !user || user.role !== 'USER') return null

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Browse Products</h1>
        {/* Cart FAB */}
        {cart.length > 0 && (
          <button onClick={() => setCartOpen(v => !v)}
            className="btn-press relative flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 font-semibold text-sm transition-all">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            Cart
            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center bg-red-500 text-white rounded-full text-[10px] font-bold">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </button>
        )}
      </div>

      {/* Search modes */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {SEARCH_MODES.map(m => (
          <button key={m.value} type="button" onClick={() => { setSearchMode(m.value); setSearch(''); setProducts([]) }}
            className={`btn-press shrink-0 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all duration-150 ${
              searchMode === m.value
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {searching
            ? <Spinner className="h-4 w-4 text-blue-500" />
            : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          }
        </div>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={
            searchMode === 'ingredient' ? 'e.g. Paracetamol…'
            : searchMode === 'company' ? 'e.g. Sun Pharma…'
            : searchMode === 'strength' ? 'e.g. 500mg…'
            : 'Search medicines, SKU…'
          }
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
        />
        {search && (
          <button onClick={() => { setSearch(''); setProducts([]) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Search results */}
      {search.length >= 2 && (
        products.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
            <p className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-50">
              {products.length} results for &ldquo;{search}&rdquo;
            </p>
            <ul className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {products.map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => addToCart(p)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50/60 transition-colors group">
                    <div className="flex items-center gap-3">
                      {p.imageUrl
                        ? <img src={getImageUrl(p.imageUrl)} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm" />
                        : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xl">💊</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-700 transition-colors">{p.name}</p>
                        {p.ingredients && (
                          <p className="text-xs text-indigo-600 font-medium">{p.ingredients} {p.strength}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {Number(p.discountPct) > 0 && (
                            <span className="text-xs text-slate-400 line-through">₹{Number(p.mrp).toFixed(0)}</span>
                          )}
                          <span className="text-sm font-bold text-emerald-600">₹{Number(p.sellingPrice).toFixed(0)}</span>
                          {Number(p.discountPct) > 0 && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                              {Number(p.discountPct).toFixed(0)}% off
                            </span>
                          )}
                          <span className="text-xs text-slate-400">· Stock: {p.quantity}</span>
                        </div>
                      </div>
                      <span className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all text-lg font-bold">+</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : !searching && (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="text-3xl mb-3">🔍</span>
            <p className="font-semibold text-slate-500">No products found for &ldquo;{search}&rdquo;</p>
          </div>
        )
      )}

      {/* Full product catalog (shown when no search is active) */}
      {search.length < 2 && (
        <>
          {catalogLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="w-12 h-12 rounded-xl skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 skeleton rounded" />
                    <div className="h-3 w-32 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : catalog.length > 0 ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                All Products ({catalog.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalog.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 group hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      {p.imageUrl ? (
                        <img
                          src={getImageUrl(p.imageUrl)}
                          alt={p.name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-100 shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-2xl shrink-0">
                          💊
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-700 transition-colors">
                          {p.name}
                        </p>
                        {p.companyName && (
                          <p className="text-xs text-slate-400 mt-0.5">{p.companyName}</p>
                        )}
                        {p.strength && (
                          <p className="text-xs text-indigo-600 font-medium mt-0.5">{p.strength}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {Number(p.discountPct) > 0 && (
                            <span className="text-[11px] text-slate-400 line-through">₹{Number(p.mrp).toFixed(0)}</span>
                          )}
                          <span className="text-sm font-bold text-emerald-600">₹{Number(p.sellingPrice).toFixed(0)}</span>
                          {Number(p.discountPct) > 0 && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                              {Number(p.discountPct).toFixed(0)}% off
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-slate-400">Stock: {p.quantity}</span>
                          <span className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all font-bold text-sm">
                            +
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-5xl mb-4">📦</span>
              <p className="font-semibold text-slate-600">No products available</p>
              <p className="text-sm text-slate-400 mt-1">Please check back later</p>
            </div>
          )}
        </>
      )}

      {/* Cart panel — mobile sheet style */}
      {cart.length > 0 && cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Your Cart ({cart.reduce((s,i)=>s+i.quantity,0)} items)</h2>
              <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {cart.map(i => (
                <div key={i.product.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{i.product.name}</p>
                    <p className="text-xs text-slate-500">₹{i.product.sellingPrice} × {i.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(i.product.id, i.quantity - 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all font-bold text-sm btn-press">−</button>
                    <span className="w-7 text-center text-sm font-bold text-slate-800">{i.quantity}</span>
                    <button onClick={() => updateQty(i.product.id, i.quantity + 1)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all font-bold text-sm btn-press">+</button>
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-16 text-right">
                    ₹{(i.product.sellingPrice * i.quantity * (1 - i.product.discountPct / 100)).toFixed(0)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-xl font-bold text-slate-900">₹{total.toFixed(2)}</p>
                </div>
                <Link href="/user/checkout" onClick={() => setCartOpen(false)}
                  className="btn-press px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 transition-all">
                  Checkout →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline cart (desktop) */}
      {cart.length > 0 && !cartOpen && (
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-3">Cart ({cart.reduce((s,i)=>s+i.quantity,0)} items)</h2>
          <div className="space-y-2">
            {cart.map(i => (
              <div key={i.product.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{i.product.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="h-6 w-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-red-50 transition btn-press">−</button>
                  <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                  <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="h-6 w-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-blue-50 transition btn-press">+</button>
                </div>
                <span className="text-sm font-bold text-slate-700 w-14 text-right">
                  ₹{(i.product.sellingPrice * i.quantity).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <p className="text-lg font-bold text-slate-900">₹{total.toFixed(2)}</p>
            <Link href="/user/checkout"
              className="btn-press px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 transition-all">
              Checkout →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}