'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import type { LedgerEntry } from '@/lib/types'

export default function UserLedgerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  const load = useCallback(async () => {
    if (!user) return
    try {
      const data = await usersApi.ledger(user.id)
      setEntries(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (user?.role === 'USER') load() }, [user, load])
  usePolling(load, 20000, user?.role === 'USER')

  if (authLoading || !user || user.role !== 'USER') return null

  const balance = entries.length > 0 ? entries[0].balanceAfter : 0

  return (
    <div className="space-y-5 pb-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Ledger</h1>
        <p className="text-xs text-slate-400 mt-0.5">Credit debits and payments · Auto-refreshes every 20s</p>
      </div>

      {/* Balance card */}
      {!loading && entries.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Current Balance</p>
          <p className={`text-3xl font-bold mt-1 ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span className="text-base font-medium ml-1 opacity-70">{balance >= 0 ? 'CR' : 'DR'}</span>
          </p>
          <p className="text-slate-500 text-xs mt-1">{entries.length} transactions total</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-4">📒</span>
          <p className="font-semibold text-slate-600">No ledger entries yet</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <ul className="space-y-2 lg:hidden">
            {entries.map(e => (
              <li key={e.id} className="card-hover bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{e.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(e.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${e.type === 'DEBIT' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {e.type === 'DEBIT' ? '−' : '+'}₹{Number(e.amount).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-400">Bal ₹{Number(e.balanceAfter).toLocaleString('en-IN')}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${e.type === 'DEBIT' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {e.type}
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
                  {['Date', 'Description', 'Type', 'Amount', 'Balance'].map((h, i) => (
                    <th key={h} className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 font-medium">{e.description}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${e.type === 'DEBIT' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold">
                      <span className={e.type === 'DEBIT' ? 'text-red-600' : 'text-emerald-600'}>
                        {e.type === 'DEBIT' ? '−' : '+'}₹{Number(e.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 font-medium">
                      ₹{Number(e.balanceAfter).toLocaleString('en-IN')}
                    </td>
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
