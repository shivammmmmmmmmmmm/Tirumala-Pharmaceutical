'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { commissionsApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
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

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchCommissions = async () => {
    setLoading(true)
    try { const data = await commissionsApi.list(); setCommissions(data) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { if (user?.role === 'ADMIN') fetchCommissions() }, [user])

  const markPaid = async (id: string) => {
    if (!confirm('Mark this commission as paid?')) return
    setPaying(id)
    try { await commissionsApi.pay(id); fetchCommissions() }
    catch (e: any) { alert(e.message) } finally { setPaying(null) }
  }

  const total = commissions.reduce((s, c) => s + c.commissionAmount, 0)
  const pending = commissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.commissionAmount, 0)

  if (authLoading || !user || user.role !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={ADMIN_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          <div className="flex gap-6 mt-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Total Commissions</p>
              <p className="text-xl font-bold text-gray-900">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Pending Payout</p>
              <p className="text-xl font-bold text-orange-600">₹{pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Sales Person', 'Order #', 'Order Amount', 'Commission %', 'Commission Amount', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commissions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No commissions yet</td></tr>
                ) : commissions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.spName || '—'}</td>
                    <td className="px-4 py-3 text-blue-600">{c.orderNumber || '—'}</td>
                    <td className="px-4 py-3">₹{Number(c.orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">{c.commissionPct}%</td>
                    <td className="px-4 py-3 font-medium text-green-700">₹{Number(c.commissionAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'PAID' ? 'bg-green-100 text-green-700' : c.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      {c.status !== 'PAID' && (
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
    </div>
  )
}
