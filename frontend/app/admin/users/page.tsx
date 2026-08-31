'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/types'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [salesPersons, setSalesPersons] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<User | null>(null)
  const [creditInput, setCreditInput] = useState('')
  const [assignedSpInput, setAssignedSpInput] = useState('')
  const [updating, setUpdating] = useState(false)
  const [ledger, setLedger] = useState<any[]>([])
  const [showLedger, setShowLedger] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({ role: 'USER', page })
      setUsers(res.data); setTotal(res.total)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [page])

  useEffect(() => { if (user?.role === 'ADMIN') fetchUsers() }, [user, fetchUsers])

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    usersApi.list({ role: 'SALES_PERSON', pageSize: 100 })
      .then(res => setSalesPersons(res.data))
      .catch(console.error)
  }, [user?.role])

  const toggleBlock = async (u: User) => {
    setUpdating(true)
    try { await usersApi.update(u.id, { isBlocked: !u.isBlocked }); fetchUsers(); setSelected(null) }
    catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  const setCredit = async (u: User) => {
    const limit = parseFloat(creditInput)
    if (isNaN(limit) || limit < 0) { alert('Enter valid credit limit'); return }
    setUpdating(true)
    try { await usersApi.setCredit(u.id, limit); setCreditInput(''); fetchUsers(); setSelected(null) }
    catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  const assignSalesPerson = async (u: User) => {
    if (!assignedSpInput) { alert('Select a sales person'); return }
    setUpdating(true)
    try {
      await usersApi.update(u.id, { assignedSpId: assignedSpInput })
      fetchUsers()
      setSelected(null)
    } catch (e: any) { alert(e.message) } finally { setUpdating(false) }
  }

  const viewLedger = async (u: User) => {
    try {
      const entries = await usersApi.ledger(u.id)
      setLedger(entries); setShowLedger(true)
    } catch (e: any) { alert(e.message) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-1">{total} registered users</p>
          </div>
          <Link href="/admin/users/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">+ Add User</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Email', 'Organization', 'Credit Limit', 'Credit Used', 'Available', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No users found</td></tr>
                ) : users.map(u => {
                  const available = (u.creditLimit||0) - (u.creditUsed||0)
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">{u.organizationName || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">₹{Number(u.creditLimit||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-red-600">₹{Number(u.creditUsed||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">₹{Number(available).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelected(u); setCreditInput(String(u.creditLimit||0)) }}
                            title="Edit / Manage"
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {total > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Manage User Modal */}
      {selected && !showLedger && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-gray-900">Manage: {selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Email</p><p className="font-medium">{selected.email}</p></div>
                <div><p className="text-gray-500">Organization</p><p className="font-medium">{selected.organizationName || '—'}</p></div>
                <div><p className="text-gray-500">Credit Limit</p><p className="font-medium text-blue-600">₹{Number(selected.creditLimit||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
                <div><p className="text-gray-500">Credit Used</p><p className="font-medium text-red-600">₹{Number(selected.creditUsed||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Set Credit Limit (₹)</p>
                <div className="flex gap-2">
                  <input type="number" value={creditInput} onChange={e => setCreditInput(e.target.value)} min="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => setCredit(selected)} disabled={updating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">Set</button>
                </div>
              </div>

              <button onClick={() => toggleBlock(selected)} disabled={updating}
                className={`w-full py-2.5 text-sm font-semibold rounded-lg transition disabled:opacity-50 ${selected.isBlocked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                {selected.isBlocked ? 'Unblock User' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedger && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-gray-900">Ledger</h2>
              <button onClick={() => { setShowLedger(false); setSelected(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Date', 'Type', 'Amount', 'Balance', 'Description'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ledger.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No ledger entries</td></tr>
                  ) : ledger.map((e: any) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${e.type === 'DEBIT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{e.type}</span></td>
                      <td className={`px-4 py-3 font-medium ${e.type === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>₹{Number(e.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-gray-700">₹{Number(e.balance_after).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-gray-600">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
