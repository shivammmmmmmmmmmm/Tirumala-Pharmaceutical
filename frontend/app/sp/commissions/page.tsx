'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { commissionsApi } from '@/lib/api'
import type { Commission } from '@/lib/types'

export default function SPCommissionsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [report, setReport]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON')
      Promise.all([commissionsApi.list(), commissionsApi.report()])
        .then(([rows, rep]) => { setCommissions(rows); setReport(rep) })
        .catch(console.error).finally(() => setLoading(false))
  }, [user])

  const earned  = commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + c.commissionAmount, 0)
  const pending = commissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.commissionAmount, 0)

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="space-y-5 pb-2">
      <h1 className="text-2xl font-bold text-slate-900">My Commissions</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
          <div className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest">Earned</p>
          <p className="text-2xl font-bold mt-1">₹{earned.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-emerald-200 text-xs mt-1">Paid to you</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}>
          <div className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-amber-200 text-xs font-semibold uppercase tracking-widest">Pending</p>
          <p className="text-2xl font-bold mt-1">₹{pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-amber-200 text-xs mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Customer summary */}
      {report.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <p className="px-5 py-4 font-bold text-slate-800 border-b border-slate-50">Customer Summary</p>
          <ul className="divide-y divide-slate-50">
            {report.map(r => (
              <li key={`${r.customerId}-${r.spId}`} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 text-sm">{r.customerName || r.customerOrg || '—'}</p>
                  <p className="font-bold text-slate-900 text-sm">₹{Number(r.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-emerald-600 font-medium">Paid ₹{Number(r.paidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-xs text-amber-600 font-medium">Pending ₹{Number(r.unpaidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-xs text-slate-400">{r.totalCount} entries</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transactions */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
      ) : commissions.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">💰</span>
          <p className="font-semibold text-slate-600">No commissions yet</p>
          <p className="text-sm text-slate-400 mt-1">Place orders to start earning</p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <ul className="space-y-2 lg:hidden">
            {commissions.map(c => (
              <li key={c.id} className="card-hover bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-600">{c.orderNumber || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.customerName || c.customerOrg || '—'}</p>
                    <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">₹{Number(c.commissionAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-slate-400">{c.commissionPct}% of ₹{Number(c.orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {['Customer', 'Order #', 'Order Amt', 'Rate', 'Commission', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {commissions.map(c => (
                  <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4 text-slate-700">{c.customerName || c.customerOrg || '—'}</td>
                    <td className="px-5 py-4 font-semibold text-blue-600">{c.orderNumber || '—'}</td>
                    <td className="px-5 py-4">₹{Number(c.orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-5 py-4 text-slate-600">{c.commissionPct}%</td>
                    <td className="px-5 py-4 font-bold text-emerald-600">₹{Number(c.commissionAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
