'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { commissionsApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { Commission } from '@/lib/types'

const SP_LINKS = [
  { href: '/sp/dashboard', label: 'Dashboard' },
  { href: '/sp/orders', label: 'Orders' },
  { href: '/sp/customers', label: 'My Customers' },
  { href: '/sp/commissions', label: 'Commissions' },
  { href: '/sp/place-order', label: 'Place Order' },
]

export default function SPCommissionsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      commissionsApi.list().then(setCommissions).catch(console.error).finally(() => setLoading(false))
    }
  }, [user])

  const earned = commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + c.commissionAmount, 0)
  const pending = commissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.commissionAmount, 0)

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={SP_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Commissions</h1>
          <div className="flex gap-4 mt-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Earned (Paid)</p>
              <p className="text-xl font-bold text-green-600">₹{earned.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-xs text-gray-500">Pending</p>
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
                  {['Order #', 'Order Amount', 'Commission %', 'Commission Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commissions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No commissions yet</td></tr>
                ) : commissions.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-blue-600 font-medium">{c.orderNumber || '—'}</td>
                    <td className="px-4 py-3">₹{Number(c.orderAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">{c.commissionPct}%</td>
                    <td className="px-4 py-3 font-medium text-green-700">₹{Number(c.commissionAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
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
