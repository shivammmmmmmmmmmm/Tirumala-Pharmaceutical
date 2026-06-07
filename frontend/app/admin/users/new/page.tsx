'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

export default function NewUserPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', organizationName: '', address: '', creditLimit: '0' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await usersApi.create({ ...form, newRole: 'USER', creditLimit: parseFloat(form.creditLimit)||0 })
      router.push('/admin/users')
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/admin/users')} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Add New User</h1>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><input className={inp} type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Organization</label><input className={inp} value={form.organizationName} onChange={e => set('organizationName', e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label><input className={inp} type="number" min="0" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><textarea className={inp} rows={2} value={form.address} onChange={e => set('address', e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition text-sm">{saving ? 'Creating…' : 'Create User'}</button>
              <button type="button" onClick={() => router.push('/admin/users')} className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm">Cancel</button>
            </div>
          </form>
        </div>
      </div>
  )
}
