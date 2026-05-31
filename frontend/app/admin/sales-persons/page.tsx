'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { User } from '@/lib/types'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

export default function AdminSalesPersonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [sps, setSps] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<User | null>(null)
  const [commInput, setCommInput] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchSPs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({ role: 'SALES_PERSON' })
      setSps(res.data); setTotal(res.total)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user?.role === 'ADMIN') fetchSPs() }, [user, fetchSPs])

  const toggleActive = async (sp: User) => {
    setUpdating(true)
    try { await usersApi.update(sp.id, { isActive: !sp.isActive }); fetchSPs(); setSelected(null) }
    catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  const setCommission = async (sp: User) => {
    const pct = parseFloat(commInput)
    if (isNaN(pct) || pct < 0 || pct > 100) { alert('Enter valid percentage (0-100)'); return }
    setUpdating(true)
    try { await usersApi.update(sp.id, { commissionPct: pct } as any); setCommInput(''); fetchSPs(); setSelected(null) }
    catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={ADMIN_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Persons</h1>
            <p className="text-sm text-gray-500 mt-1">{total} sales persons</p>
          </div>
          <Link href="/admin/sales-persons/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">+ Add Sales Person</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Email', 'Phone', 'Territory', 'Commission %', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sps.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No sales persons yet</td></tr>
                ) : sps.map(sp => (
                  <tr key={sp.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{sp.name}</td>
                    <td className="px-4 py-3 text-gray-600">{sp.email}</td>
                    <td className="px-4 py-3 text-gray-600">{sp.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{sp.territory || '—'}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{sp.commissionPct || 0}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {sp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelected(sp); setCommInput(String(sp.commissionPct||0)) }}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-gray-900">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Email</p><p className="font-medium">{selected.email}</p></div>
                <div><p className="text-gray-500">Territory</p><p className="font-medium">{selected.territory || '—'}</p></div>
                <div><p className="text-gray-500">Commission</p><p className="font-medium text-green-600">{selected.commissionPct||0}%</p></div>
                <div><p className="text-gray-500">Status</p><p className="font-medium">{selected.isActive ? 'Active' : 'Inactive'}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Set Commission %</p>
                <div className="flex gap-2">
                  <input type="number" value={commInput} onChange={e => setCommInput(e.target.value)} min="0" max="100" step="0.1"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => setCommission(selected)} disabled={updating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">Set</button>
                </div>
              </div>
              <button onClick={() => toggleActive(selected)} disabled={updating}
                className={`w-full py-2.5 text-sm font-semibold rounded-lg transition disabled:opacity-50 ${selected.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                {selected.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
