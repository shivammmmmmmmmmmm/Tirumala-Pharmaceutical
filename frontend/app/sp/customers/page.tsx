'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { User } from '@/lib/types'

const SP_LINKS = [
  { href: '/sp/dashboard', label: 'Dashboard' },
  { href: '/sp/orders', label: 'Orders' },
  { href: '/sp/customers', label: 'My Customers' },
  { href: '/sp/commissions', label: 'Commissions' },
  { href: '/sp/place-order', label: 'Place Order' },
]

export default function SPCustomersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      usersApi.list({ role: 'USER' }).then(res => setCustomers(res.data)).catch(console.error).finally(() => setLoading(false))
    }
  }, [user])

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={SP_LINKS} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Customers ({customers.length})</h1>
          <Link href="/sp/customers/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">+ Register Customer</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-400">No customers assigned yet</div>
            ) : customers.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.email}</p>
                    {c.organizationName && <p className="text-xs text-gray-400 mt-1">{c.organizationName}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-gray-400">Credit Limit</p><p className="font-medium text-gray-700">₹{Number(c.creditLimit||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
                  <div><p className="text-gray-400">Outstanding</p><p className="font-medium text-red-600">₹{Number(c.creditUsed||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
