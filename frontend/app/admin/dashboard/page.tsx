'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi } from '@/lib/api'
import type { AdminDashboard } from '@/lib/types'

const EMPTY: AdminDashboard = {
  totalUsers: 0, totalSPs: 0, totalProducts: 0, lowStock: 0, totalOrders: 0,
  pendingOrders: 0, totalRevenue: 0, pendingPayments: 0, pendingCommissions: 0,
  recentOrders: [], topProducts: [],
}

const STATUS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-100 text-slate-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

function Metric({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-2 tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<AdminDashboard>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const stats = await dashboardApi.get()
      setData({ ...EMPTY, ...stats, recentOrders: stats.recentOrders ?? [], topProducts: stats.topProducts ?? [] })
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN') load()
  }, [user, load])

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-medium text-blue-600">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Operations overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time snapshot of distribution performance</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="self-start px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {fetchError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{fetchError}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Metric label="Revenue" value={fmt(data.totalRevenue)} accent="text-emerald-600" />
            <Metric label="Receivables" value={fmt(data.pendingPayments)} hint="Unpaid order balance" accent="text-amber-600" />
            <Metric label="Orders" value={data.totalOrders} hint={`${data.pendingOrders} pending approval`} accent="text-blue-600" />
            <Metric label="Commission due" value={fmt(data.pendingCommissions)} accent="text-violet-600" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <Metric label="Customers" value={data.totalUsers} accent="text-slate-800" />
            <Metric label="Sales team" value={data.totalSPs} accent="text-slate-800" />
            <Metric label="Products" value={data.totalProducts} accent="text-slate-800" />
            <Metric label="Low stock" value={data.lowStock} hint="Needs reorder" accent="text-red-600" />
          </div>

          {(data.lowStockProducts?.length ?? 0) > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-amber-900 text-sm">Stock alerts</h3>
                <Link href="/admin/inventory" className="text-xs font-medium text-amber-800 hover:underline">Manage inventory →</Link>
              </div>
              <ul className="text-sm text-amber-900/90 grid sm:grid-cols-2 gap-1">
                {data.lowStockProducts!.slice(0, 6).map((p, i) => (
                  <li key={i}>{p.name} — {p.quantity} left (reorder {p.reorderLevel})</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Recent orders</h2>
                <Link href="/admin/orders" prefetch className="text-sm text-blue-600 font-medium hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {data.recentOrders.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400 text-center">No orders yet</p>
                ) : (
                  data.recentOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{o.orderNumber}</p>
                        <p className="text-xs text-slate-500">{o.userName || 'Customer'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS[o.status] || ''}`}>{o.status}</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{fmt(o.totalAmount)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Top products</h2>
                <Link href="/admin/products" prefetch className="text-sm text-blue-600 font-medium hover:underline">Catalog</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {data.topProducts.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400 text-center">No sales data yet</p>
                ) : (
                  data.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <p className="text-sm font-medium text-slate-900 flex-1">{p.name}</p>
                      <p className="text-sm text-slate-500 tabular-nums">{p.sold} sold</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/admin/products/new', label: 'Add product', desc: 'Catalog' },
              { href: '/admin/users/new', label: 'Add customer', desc: 'Users' },
              { href: '/admin/sales-persons/new', label: 'Add sales rep', desc: 'Team' },
              { href: '/admin/orders', label: 'Manage orders', desc: 'Fulfillment' },
            ].map(a => (
              <Link
                key={a.href}
                href={a.href}
                prefetch
                className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">{a.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{a.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
