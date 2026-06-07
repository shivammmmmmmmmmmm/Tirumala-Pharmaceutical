'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/types'

export default function SPCustomersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<User[]>([])
  const [pending, setPending] = useState<User[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      Promise.all([
        usersApi.list({ role: 'USER', approvalStatus: 'APPROVED', pageSize: 100 }),
        usersApi.list({ role: 'USER', approvalStatus: 'PENDING', pageSize: 100 }),
      ])
        .then(([approved, pend]) => {
          setCustomers(approved.data)
          setPending(pend.data)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [user])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.organizationName || '').toLowerCase().includes(search.toLowerCase())
  )

  const TYPE_COLOR: Record<string, string> = {
    PHARMACY: 'bg-blue-100 text-blue-700', HOSPITAL: 'bg-purple-100 text-purple-700',
    CLINIC: 'bg-teal-100 text-teal-700', DISTRIBUTOR: 'bg-orange-100 text-orange-700',
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Customers</h1>
          <p className="text-xs text-slate-400 mt-0.5">{customers.length} total customers</p>
        </div>
        <Link href="/sp/customers/new"
          className="btn-press flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </Link>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">{pending.length} awaiting admin approval</p>
          <ul className="space-y-1">
            {pending.map(p => (
              <li key={p.id} className="text-xs text-amber-700">{p.organizationName || p.name} — submitted, pending verification</li>
            ))}
          </ul>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, org…"
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all" />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">{search ? '🔍' : '👥'}</span>
          <p className="font-semibold text-slate-600">{search ? 'No results found' : 'No customers yet'}</p>
          {!search && (
            <Link href="/sp/customers/new" className="mt-4 btn-press px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-all">
              Register First Customer →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => {
            const creditPct = c.creditLimit ? Math.min(100, ((c.creditUsed || 0) / c.creditLimit) * 100) : 0
            return (
              <div key={c.id} className="card-hover bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{c.email}</p>
                    {c.organizationName && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{c.organizationName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {c.customerType && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[c.customerType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {c.customerType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Credit Limit</span>
                    <span className="font-semibold text-slate-700">₹{Number(c.creditLimit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${creditPct > 80 ? 'bg-red-500' : creditPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${creditPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Outstanding</span>
                    <span className={`font-bold ${(c.creditUsed || 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      ₹{Number(c.creditUsed || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
