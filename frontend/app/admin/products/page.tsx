'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { productsApi } from '@/lib/api'
import type { Product } from '@/lib/types'
import { useDebounce } from '@/lib/use-debounce'
import { getImageUrl } from '@/lib/image-utils'
import SearchableSelect from '@/components/SearchableSelect'

interface FilterOptions {
  dosageForms: string[]
  companies: { id: string; name: string }[]
  products: { id: string; name: string }[]
  compositions: { id: string; name: string }[]
}

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Table state
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Search
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  // Cascading filter state
  const [dosageForm, setDosageForm] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [productId, setProductId] = useState('')   // filter by specific product id
  const [compositionId, setCompositionId] = useState('')

  // Filter options (driven by cascading selection)
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ dosageForms: [], companies: [], products: [], compositions: [] })
  const [optsLoading, setOptsLoading] = useState(true)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  // Load cascading filter options whenever selection changes
  useEffect(() => {
    if (!user?.role) return
    setOptsLoading(true)
    productsApi.filterOptions({
      dosageForm: dosageForm || undefined,
      companyId: companyId || undefined,
      compositionId: compositionId || undefined,
    }).then(setFilterOpts).catch(console.error).finally(() => setOptsLoading(false))
  }, [dosageForm, companyId, compositionId, user])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await productsApi.list({
        search: debouncedSearch || undefined,
        dosageForm: dosageForm || undefined,
        companyId: companyId || undefined,
        compositionId: compositionId || undefined,
        // if a specific product is selected, search by its name
        ...(productId ? { search: filterOpts.products.find(p => p.id === productId)?.name || debouncedSearch } : {}),
        page, pageSize: 20,
      })
      if (abortRef.current === ac) { setProducts(res.data); setTotal(res.total) }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }, [debouncedSearch, dosageForm, companyId, compositionId, productId, page, filterOpts.products])

  useEffect(() => {
    if (user?.role === 'ADMIN') fetchProducts()
  }, [user, fetchProducts])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this product?')) return
    setDeleting(id)
    try { await productsApi.delete(id); fetchProducts() }
    catch (e: any) { alert(e.message) }
    finally { setDeleting(null) }
  }

  const clearFilters = () => {
    setDosageForm(''); setCompanyId(''); setProductId(''); setCompositionId(''); setSearch(''); setPage(1)
  }

  const hasFilters = dosageForm || companyId || productId || compositionId || search

  if (authLoading || !user || user.role !== 'ADMIN') return null

  const dosageOpts = filterOpts.dosageForms.map(d => ({ value: d, label: d }))
  const companyOpts = filterOpts.companies.map(c => ({ value: c.id, label: c.name }))
  const productOpts = filterOpts.products.map(p => ({ value: p.id, label: p.name }))
  const compositionOpts = filterOpts.compositions.map(c => ({ value: c.id, label: c.name }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} products total</p>
        </div>
        <Link href="/admin/products/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
          + Add Product
        </Link>
      </div>

      {/* Search + Cascading filter row */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Token search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Smart search — try 'Pantop D', 'D Pantop', '500 Azithromycin'…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Cascading dropdowns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dosage Form</label>
            <SearchableSelect
              options={dosageOpts}
              value={dosageForm}
              onChange={v => { setDosageForm(v); setCompanyId(''); setProductId(''); setCompositionId(''); setPage(1) }}
              placeholder="All forms"
              disabled={optsLoading && !dosageOpts.length}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company</label>
            <SearchableSelect
              options={companyOpts}
              value={companyId}
              onChange={v => { setCompanyId(v); setProductId(''); setCompositionId(''); setPage(1) }}
              placeholder="All companies"
              disabled={optsLoading && !companyOpts.length}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Product</label>
            <SearchableSelect
              options={productOpts}
              value={productId}
              onChange={v => { setProductId(v); setPage(1) }}
              placeholder="All products"
              disabled={optsLoading && !productOpts.length}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Composition</label>
            <SearchableSelect
              options={compositionOpts}
              value={compositionId}
              onChange={v => { setCompositionId(v); setProductId(''); setPage(1) }}
              placeholder="All compositions"
              disabled={optsLoading && !compositionOpts.length}
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-2">
            <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear all filters
            </button>
            {dosageForm && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{dosageForm}</span>}
            {companyId && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">{filterOpts.companies.find(c => c.id === companyId)?.name}</span>}
            {compositionId && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">{filterOpts.compositions.find(c => c.id === compositionId)?.name}</span>}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Product', 'Company', 'Category', 'Composition', 'Strength', 'MRP', 'Offer Price', 'Stock', 'Actions'].map(h => (
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
                        <img src={getImageUrl(p.imageUrl)} alt={p.name} className="w-10 h-10 rounded object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku}</p>
                        {p.dosageForm && <p className="text-[10px] text-indigo-500 font-medium">{p.dosageForm}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.companyName || p.manufacturer || '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p.category || '—'}</span></td>

                  {/* Composition — always shows full text, wraps naturally */}
                  <td className="px-4 py-3 text-xs text-gray-700 min-w-[160px]">
                    {p.ingredients || <span className="text-gray-400">—</span>}
                  </td>

                  <td className="px-4 py-3 text-gray-600 text-xs">{p.strength || '—'}</td>
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
                    <div className="flex items-center gap-2">
                      {/* Edit — pen icon */}
                      <Link
                        href={`/admin/products/${p.id}`}
                        title="Edit"
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </Link>
                      {/* Deactivate — trash icon */}
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        title="Deactivate"
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition disabled:opacity-40"
                      >
                        {deleting === p.id ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                            <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
