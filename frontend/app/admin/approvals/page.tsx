'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/types'
import { usePolling } from '@/hooks/use-polling'

export default function AdminApprovalsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [pending, setPending] = useState<User[]>([])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [creditLimit, setCreditLimit] = useState('50000')
  const [spCommissionPct, setSpCommissionPct] = useState('5')
  const [rejectRemark, setRejectRemark] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await usersApi.list({ role: 'USER', approvalStatus: 'PENDING', pageSize: 50 })
      setPending(res.data as User[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 10000, !!user && user.role === 'ADMIN')

  const approve = async (id: string) => {
    setActing(true)
    try {
      await usersApi.approve(id, true, {
        creditLimit: parseFloat(creditLimit) || 0,
        spCommissionPct: parseFloat(spCommissionPct) || 0,
      })
      setSelected(null)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setActing(false)
    }
  }

  const reject = async (id: string) => {
    if (!rejectRemark.trim()) {
      alert('Please enter a rejection remark')
      return
    }
    setActing(true)
    try {
      await usersApi.approve(id, false, { rejectionRemark: rejectRemark.trim() })
      setSelected(null)
      setRejectRemark('')
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Rejection failed')
    } finally {
      setActing(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verify pharmacy details referred by sales persons · set credit limit &amp; commission
        </p>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {pending.length === 0 ? (
        <p className="text-slate-500 bg-white border rounded-2xl p-8 text-center">No pending approvals.</p>
      ) : (
        <div className="space-y-3">
          {pending.map(u => (
            <div key={u.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-slate-900">{u.name}</p>
                  <p className="text-sm text-slate-600">{u.organizationName} · {u.customerType}</p>
                  <p className="text-sm text-slate-500">{u.email} · {u.phone}</p>
                  <p className="text-xs text-emerald-700 mt-2 font-medium">
                    Referred by: {u.assignedSpName || '—'} ({u.referredBySpCode || u.assignedSpCode || '—'})
                  </p>
                  <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="font-semibold text-slate-700">Billing</p>
                      <p>{u.billingAddress || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="font-semibold text-slate-700">Shipping</p>
                      <p>{u.shippingAddress || '—'}</p>
                    </div>
                  </div>
                  {(u.latitude || u.longitude) && (
                    <p className="text-xs text-slate-400 mt-2">📍 {u.latitude}, {u.longitude}</p>
                  )}
                  <div className="flex gap-3 mt-3 text-xs">
                    {u.aadhaarUrl && <a href={u.aadhaarUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Aadhaar</a>}
                    {u.photoUrl && <a href={u.photoUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Photo</a>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={() => { setSelected(u); setCreditLimit('50000'); setSpCommissionPct('5') }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
                  >
                    Review &amp; Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(u)}
                    className="px-4 py-2 border border-red-200 text-red-700 rounded-xl text-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-lg">{selected.name}</h2>
            <p className="text-sm text-slate-500">Confirm addresses before approving.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Credit limit (₹) *</label>
                <input type="number" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">SP commission % *</label>
                <input type="number" value={spCommissionPct} onChange={e => setSpCommissionPct(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Rejection remark (if rejecting)</label>
              <textarea value={rejectRemark} onChange={e => setRejectRemark(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Required when rejecting" />
            </div>

            <div className="flex gap-2">
              <button type="button" disabled={acting} onClick={() => approve(selected.id)} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                Approve
              </button>
              <button type="button" disabled={acting} onClick={() => reject(selected.id)} className="flex-1 py-2.5 border border-red-300 text-red-700 rounded-xl text-sm font-semibold disabled:opacity-50">
                Reject
              </button>
              <button type="button" onClick={() => setSelected(null)} className="px-4 py-2.5 border rounded-xl text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
