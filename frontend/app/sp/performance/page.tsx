'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import { SkeletonStats } from '@/components/Loader'

const METRICS = [
  { key: 'myCustomers',       label: 'Total Customers',     icon: '👥', format: (v: any) => v },
  { key: 'myOrders',          label: 'Total Orders',         icon: '📋', format: (v: any) => v },
  { key: 'pendingDeliveries', label: 'Pending Deliveries',   icon: '🚚', format: (v: any) => v },
  { key: 'totalSales',        label: 'Total Sales',          icon: '💹', format: (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
  { key: 'monthlySales',      label: 'This Month Sales',     icon: '📅', format: (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
  { key: 'monthlyOrders',     label: 'This Month Orders',    icon: '🗓', format: (v: any) => v },
  { key: 'earnedCommission',  label: 'Earned Commission',    icon: '✅', format: (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
  { key: 'pendingCommission', label: 'Pending Commission',   icon: '⏳', format: (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
]

const COLORS = [
  'from-blue-500 to-blue-600',   'from-indigo-500 to-indigo-600',
  'from-orange-500 to-amber-600','from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600','from-cyan-500 to-blue-600',
  'from-green-500 to-emerald-600','from-amber-500 to-orange-600',
]

export default function SPPerformancePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [d, setD]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try { setD(await dashboardApi.get()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 15000, user?.role === 'SALES_PERSON')

  if (authLoading || !user) return null

  return (
    <div className="space-y-5 pb-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Performance</h1>
        <p className="text-xs text-slate-400 mt-0.5">Live metrics · Updates every 15s</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {METRICS.map((m, i) => (
            <div key={m.key}
              className={`card-hover relative overflow-hidden rounded-2xl p-4 text-white bg-gradient-to-br ${COLORS[i]} shadow-lg`}>
              <div className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-white/10" />
              <span className="text-2xl mb-2 block">{m.icon}</span>
              <p className="text-xl font-bold leading-tight">{d ? m.format(d[m.key]) : '—'}</p>
              <p className="text-xs font-medium opacity-80 mt-0.5 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
