'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { productsApi } from '@/lib/api'
import type { Product } from '@/lib/types'
import { useDebounce } from '@/lib/use-debounce'
import { getImageUrl } from '@/lib/image-utils'


const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const abortRef = useRef<AbortController | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await productsApi.list({ search: debouncedSearch, category, page, pageSize: 20 })
      setProducts(res.data)
      setTotal(res.total)
    } catch (e: any) {
      // ignore aborted requests
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      // Only stop loading if this is the latest request
      if (abortRef.current === ac) setLoading(false)
    }
  }, [debouncedSearch, category, page])


  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchProducts()
      productsApi.categories().then(setCategories).catch(() => {})
    }
  }, [user, fetchProducts])

  useEffect(() => {
    // When component unmounts, cancel in-flight request.
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this product?')) return
    setDeleting(id)
    try { await productsApi.delete(id); fetchProducts() }
    catch (e: any) { alert(e.message) }
    finally { setDeleting(null) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500 mt-1">{total} products total</p>
          </div>
          <Link href="/admin/products/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
            + Add Product
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, ingredients, company, strength…"
            className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Product', 'Company', 'Category', 'Strength', 'MRP', 'Offer Price', 'Stock', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No products found</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getImageUrl(p.imageUrl)} alt={p.name} className="w-10 h-10 rounded object-cover border border-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.companyName || p.manufacturer || '—'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p.category || '—'}</span></td>
                    <td className="px-4 py-3 text-gray-600">{p.strength || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">₹{p.mrp}</td>
                    <td className="px-4 py-3">
                      {Number(p.discountPct) > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 line-through">₹{Number(p.mrp).toLocaleString('en-IN')}</span>
                          <span className="font-semibold text-green-700">₹{Number(p.sellingPrice).toLocaleString('en-IN')}</span>
                          <span className="text-[11px] text-emerald-600">{Number(p.discountPct)}% off</span>
                        </div>
                      ) : (
                        <span className="font-medium text-green-700">₹{p.sellingPrice}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${p.quantity <= p.reorderLevel ? 'text-red-600' : 'text-gray-700'}`}>{p.quantity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/admin/products/${p.id}`}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition font-medium">Edit</Link>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition font-medium disabled:opacity-50">
                          {deleting === p.id ? '…' : 'Deactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  )
}
