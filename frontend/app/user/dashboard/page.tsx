'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import { SkeletonCard, SkeletonStats } from '@/components/Loader'
import type { UserDashboard, Order } from '@/lib/types'

const STATUS_PILL: Record<string, string> = {
  PENDING:    'badge-pending',
  APPROVED:   'badge-approved',
  DISPATCHED: 'badge-dispatched',
  DELIVERED:  'badge-delivered',
  COMPLETED:  'badge-completed',
  CANCELLED:  'badge-cancelled',
}

const QUICK = [
  { href: '/user/products',  label: 'Browse Products',  icon: '🔍', color: 'from-blue-500 to-blue-600',   shadow: 'shadow-blue-500/20' },
  { href: '/user/orders',    label: 'Track Orders',      icon: '📦', color: 'from-indigo-500 to-indigo-600', shadow: 'shadow-indigo-500/20' },
  { href: '/user/ledger',    label: 'Ledger',            icon: '📒', color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
  { href: '/user/payments',  label: 'Payments',          icon: '💳', color: 'from-emerald-500 to-teal-600',  shadow: 'shadow-emerald-500/20' },
]

export default function UserDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData]     = useState<UserDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  const load = () => {
    if (!user || user.role !== 'USER') return
    dashboardApi.get().then(setData).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { if (user?.role === 'USER') load() }, [user])
  usePolling(load, 15000, user?.role === 'USER')

  if (authLoading || !user || user.role !== 'USER') return null

  const creditPct = data ? Math.min(100, (data.creditUsed / (data.creditLimit || 1)) * 100) : 0

  return (
    <div className="space-y-5 pb-2">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hey, {user.name.split(' ')[0]} 👋
        </h1>
        {user.organizationName && (
          <p className="text-sm text-slate-500 mt-0.5">{user.organizationName}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-40 rounded-2xl" />
          <SkeletonStats count={3} />
          <SkeletonCard rows={4} />
        </div>
      ) : data ? (
        <>
          {/* Credit card */}
          <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 60%, #7c3aed 100%)' }}>
            {/* Decorative circles */}
            <div className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/5" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest">Credit Account</p>
                  <p className="text-4xl font-bold mt-2 tracking-tight">
                    ₹{Number(data.availableCredit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-blue-200 text-sm mt-1">Available Credit</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-200 text-xs">Total Limit</p>
                  <p className="text-xl font-bold mt-0.5">
                    ₹{Number(data.creditLimit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-blue-200 mb-1.5">
                  <span>Used ₹{Number(data.creditUsed).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span>{creditPct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full transition-all duration-700" style={{ width: `${creditPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Orders',      value: data.myOrders,   color: 'text-slate-900', bg: 'bg-white' },
              { label: 'Total Spent', value: `₹${Number(data.totalSpent).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-blue-600', bg: 'bg-white' },
              { label: 'Outstanding', value: `₹${Number(data.outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-red-500', bg: 'bg-white' },
            ].map(s => (
              <div key={s.label} className="card-hover bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK.map(a => (
                <Link key={a.href} href={a.href}
                  className={`card-hover btn-press flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${a.color} text-white shadow-lg ${a.shadow}`}>
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-xs font-semibold text-center leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-800">Recent Orders</h2>
              <Link href="/user/orders" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                View all →
              </Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-slate-400">No orders yet</p>
                <Link href="/user/products" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
                  Start shopping →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {data.recentOrders.map((o: Order) => (
                  <li key={o.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{o.orderNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>
                        {o.status}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        ₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
