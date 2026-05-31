'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { usePolling } from '@/hooks/use-polling'
import type { LedgerEntry } from '@/lib/types'

const USER_LINKS = [
  { href: '/user/dashboard', label: 'Dashboard' },
  { href: '/user/products', label: 'Browse Products' },
  { href: '/user/orders', label: 'My Orders' },
  { href: '/user/ledger', label: 'Ledger' },
]

export default function UserLedgerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'USER')) router.replace('/login')
  }, [user, authLoading, router])

  const loadLedger = useCallback(async () => {
    if (!user) return
    try {
      const data = await usersApi.ledger(user.id)
      setEntries(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user?.role === 'USER') loadLedger()
  }, [user, loadLedger])

  usePolling(loadLedger, 20000, user?.role === 'USER')

  if (authLoading || !user || user.role !== 'USER') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={USER_LINKS} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Ledger</h1>
        <p className="text-sm text-gray-500 mb-6">Credit debits and payments on your account</p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No ledger entries yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(e.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{e.description}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          e.type === 'DEBIT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {e.type === 'DEBIT' ? '-' : '+'}₹{Number(e.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      ₹{Number(e.balanceAfter).toLocaleString('en-IN')}
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
