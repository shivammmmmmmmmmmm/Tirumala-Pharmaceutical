'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { commissionsApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import ScreenshotView from '@/components/ScreenshotView'
import type { Commission } from '@/lib/types'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

export default function AdminCommissionsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<string | null>(null)
  const [report, setReport] = useState<any[]>([])
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [readyForRelease, setReadyForRelease] = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [settingCommission, setSettingCommission] = useState<string | null>(null)
  const [pctByOrder, setPctByOrder] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'all' | 'release' | 'pending-setup'>('all')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchCommissions = async () => {
    setLoading(true)
    try {
      const [data, rep, pending, ready] = await Promise.all([
        commissionsApi.list({ status: status || undefined }),
        commissionsApi.report({ status: status || undefined }),
        commissionsApi.pendingOrders(),
        commissionsApi.readyForRelease(),
      ])
      setCommissions(data)
      setReport(rep)
      setPendingOrders(pending)
      setReadyForRelease(ready)
      const pcts: Record<string, string> = {}
      pending.forEach((o: any) => { pcts[o.id] = String(o.spDefaultPct || 5) })
      setPctByOrder(pcts)
    }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { if (user?.role === 'ADMIN') fetchCommissions() }, [user, status])
  usePolling(fetchCommissions, 8000, user?.role === 'ADMIN')

  const setCommission = async (orderId: string) => {
    const pct = parseFloat(pctByOrder[orderId] || '0')
    if (!pct || pct <= 0) { alert('Enter valid commission %'); return }
    setSettingCommission(orderId)
    try {
      await commissionsApi.createFromOrder(orderId, pct)
      fetchCommissions()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSettingCommission(null)
    }
  }

  const markPaid = async (id: string) => {
    if (!confirm('Mark this commission as paid?')) return
    setPaying(id)
    try { await commissionsApi.pay(id); fetchCommissions() }
    catch (e: any) { alert(e.message) } finally { setPaying(null) }
  }

  // 🆕 Release commission after user confirms receipt
  const releaseCommission = async (id: string) => {
    if (!confirm('Release this commission? This will mark it as PAID and complete the order.')) return
    setReleasing(id)
    try {
      await commissionsApi.release(id)
      alert('✅ Commission released! Order completed.')
      fetchCommissions()
    } catch (e: any) { alert(e.message) } finally { setReleasing(null) }
  }

  const total = commissions.reduce((s, c) => s + c.commissionAmount, 0)
  const pending = commissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.commissionAmount, 0)
  const paid = commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + c.commissionAmount, 0)

  if (authLoading || !user || user.role !== 'ADMIN') return null

  return (
    <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          <div className="mt-3 flex flex-wrap gap-3">
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
          <div className="flex gap-6 mt-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Total Commissions</p>
              <p className="text-xl font-bold text-gray-900">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Pending Payout</p>
              <p className="text-xl font-bold text-orange-600">₹{pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Paid</p>
              <p className="text-xl font-bold text-green-600">₹{paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setActiveTab('release')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'release' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            🎯 Ready to Release ({readyForRelease.length})
          </button>
          <button onClick={() => setActiveTab('pending-setup')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'pending-setup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            ⏳ Pending Setup ({pendingOrders.length})
          </button>
          <button onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            All ({commissions.length})
          </button>
        </div>

        {/* 🆕 Ready to Release Tab */}
        {activeTab === 'release' && readyForRelease.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-200 bg-emerald-100/50">
              <h2 className="font-semibold text-emerald-900">Orders Ready for Commission Release ({readyForRelease.length})</h2>
              <p className="text-xs text-emerald-700 mt-0.5">Customer confirmed receipt — release commission to complete</p>
            </div>
            <div className="divide-y divide-emerald-100">
              {readyForRelease.map((item: any) => (
                <div key={item.commissionId} className="px-4 py-4 flex flex-wrap items-center justify-between gap-3 bg-white/60">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{item.orderNumber}</p>
                    <p className="text-sm text-gray-600">
                      Customer: {item.customerName || item.customerOrg || '—'} · SP: {item.spName}
                    </p>
                    <p className="text-sm font-medium text-gray-800 mt-1">
                      Commission: ₹{Number(item.amount).toLocaleString('en-IN')} ({item.pct}%)
                    </p>
                    {item.receiptConfirmedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Customer confirmed: {new Date(item.receiptConfirmedAt).toLocaleString()}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                      {item.deliveryScreenshotUrl && (
                        <ScreenshotView url={item.deliveryScreenshotUrl} label="View delivery screenshot" />
                      )}
                      {item.paymentScreenshotUrl && (
                        <ScreenshotView url={item.paymentScreenshotUrl} label="View payment screenshot" />
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => releaseCommission(item.commissionId)}
                    disabled={releasing === item.commissionId}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 shadow-md shadow-emerald-500/25"
                  >
                    {releasing === item.commissionId ? '…' : '🎉 Release Commission'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'release' && readyForRelease.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">✅</span>
            <p className="font-semibold text-slate-600">No orders ready for release</p>
            <p className="text-sm text-slate-400 mt-1">When customers confirm receipt, they'll appear here</p>
          </div>
        )}

        {/* Pending Setup Tab */}
        {activeTab === 'pending-setup' && pendingOrders.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-200 bg-amber-100/50">
              <h2 className="font-semibold text-amber-900">Awaiting commission setup ({pendingOrders.length})</h2>
              <p className="text-xs text-amber-700 mt-0.5">Customer confirmed receipt — set sales person commission</p>
            </div>
            <div className="divide-y divide-amber-100">
              {pendingOrders.map((o: any) => (
                <div key={o.id} className="px-4 py-4 flex flex-wrap items-center justify-between gap-3 bg-white/60">
                  <div>
                    <p className="font-semibold text-gray-900">{o.orderNumber}</p>
                    <p className="text-sm text-gray-600">{o.userName} · SP: {o.spName}</p>
                    <p className="text-sm font-medium text-gray-800">₹{Number(o.totalAmount).toLocaleString('en-IN')}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {o.deliveryScreenshotUrl && (
                        <ScreenshotView url={o.deliveryScreenshotUrl} label="View delivery screenshot" />
                      )}
                      {o.paymentScreenshotUrl && (
                        <ScreenshotView url={o.paymentScreenshotUrl} label="View payment screenshot" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={pctByOrder[o.id] || ''}
                      onChange={e => setPctByOrder(p => ({ ...p, [o.id]: e.target.value }))}
                      className="w-20 px-2 py-1.5 border rounded-lg text-sm"
                      placeholder="%"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <button
                      type="button"
                      onClick={() => setCommission(o.id)}
                      disabled={settingCommission === o.id}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      {settingCommission === o.id ? '…' : 'Set Commission'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pending-setup' && pendingOrders.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">✅</span>
            <p className="font-semibold text-slate-600">No pending setups</p>
          </div>
        )}

        {report.length > 0 && activeTab === 'all' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Commission by Salesperson and Customer</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Sales Person', 'Customer', 'Total', 'Paid', 'Unpaid', 'Entries'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.map(r => (
                  <tr key={`${r.spId}-${r.customerId}`} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.spName || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.customerName || r.customerOrg || '—'}</td>
                    <td className="px-4 py-3">₹{Number(r.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-green-700 font-medium">₹{Number(r.paidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-orange-700 font-medium">₹{Number(r.unpaidAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-gray-500">{r.totalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : activeTab === 'all' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Sales Person', 'Customer', 'Order #', 'Order Amount', 'Commission %', 'Commission Amount', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commissions.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No commissions yet</td></tr>
                ) : commissions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.spName || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.customerName || c.customerOrg || '—'}</td>
                    <td className="px-4 py-3 text-blue-600">{c.orderNumber || '—'}</td>
                    <td className="px-4 py-3">₹{Number(c.orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">{c.commissionPct}%</td>
                    <td className="px-4 py-3 font-medium text-green-700">₹{Number(c.commissionAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'PAID' ? 'bg-green-100 text-green-700' : c.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      {c.status === 'PENDING' && (
                        <button onClick={() => releaseCommission(c.id)} disabled={releasing === c.id}
                          className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 font-medium disabled:opacity-50">
                          {releasing === c.id ? '…' : 'Release'}
                        </button>
                      )}
                      {c.status !== 'PAID' && c.status !== 'PENDING' && (
                        <button onClick={() => markPaid(c.id)} disabled={paying === c.id}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium disabled:opacity-50">
                          {paying === c.id ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
