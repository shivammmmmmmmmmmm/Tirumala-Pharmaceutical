'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi, areasApi } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import type { CustomerType } from '@/lib/types'

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'PHARMACY',    label: 'Pharmacy' },
  { value: 'CLINIC',      label: 'Clinic' },
  { value: 'HOSPITAL',    label: 'Hospital' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
]

export default function AdminNewUserPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '',
    organizationName: '', customerType: 'PHARMACY' as CustomerType,
    address: '', areaId: '',
    creditLimit: '0',
    drugLicenceNumber: '', drugLicenceExpiry: '',
    gstNumber: '', foodLicenceNumber: '',
  })

  const [aadhaarDataUrl, setAadhaar]           = useState('')
  const [photoDataUrl, setPhoto]               = useState('')
  const [drugLicenceDataUrl, setDrugLicence]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
    areasApi.list().then(setAreas).catch(() => {})
  }, [user, authLoading, router])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await usersApi.create({
        ...form,
        newRole: 'USER',
        creditLimit: parseFloat(form.creditLimit) || 0,
        aadhaarDataUrl: aadhaarDataUrl || undefined,
        photoDataUrl: photoDataUrl || undefined,
        drugLicenceDataUrl: drugLicenceDataUrl || undefined,
      })
      router.push('/admin/users')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.push('/admin/users')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Add Customer</h1>
      </div>

      <div className="bg-white rounded-xl border p-6">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <input className={inp} type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input className={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Organization / Shop Name</label>
              <input className={inp} value={form.organizationName} onChange={e => set('organizationName', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Customer Type</label>
              <select className={inp} value={form.customerType} onChange={e => set('customerType', e.target.value)}>
                {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Assigned Area</label>
              <select className={inp} value={form.areaId} onChange={e => set('areaId', e.target.value)}>
                <option value="">— Select —</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Credit Limit (₹)</label>
              <input className={inp} type="number" min="0" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea className={inp} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Shop / delivery address" />
            </div>
          </div>

          {/* Licence details */}
          <h3 className="font-medium text-gray-900 pt-2">Licence & Compliance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Drug Licence No.</label>
              <input className={inp} value={form.drugLicenceNumber} onChange={e => set('drugLicenceNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Drug Licence Expiry</label>
              <input className={inp} type="date" value={form.drugLicenceExpiry} onChange={e => set('drugLicenceExpiry', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GST Number</label>
              <input className={inp} value={form.gstNumber} onChange={e => set('gstNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Food Licence No.</label>
              <input className={inp} value={form.foodLicenceNumber} onChange={e => set('foodLicenceNumber', e.target.value)} />
            </div>
          </div>

          {/* Documents */}
          <h3 className="font-medium text-gray-900 pt-2">Documents</h3>
          <div className="grid grid-cols-2 gap-4">
            <FileUpload label="Aadhaar / PAN" onFile={d => setAadhaar(d)} accept="image/*,.pdf" />
            <FileUpload label="Photo" onFile={d => setPhoto(d)} accept="image/*" capture="user" />
            <FileUpload label="Drug Licence Copy" onFile={d => setDrugLicence(d)} accept="image/*,.pdf" />
          </div>

          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Customer'}
          </button>
        </form>
      </div>
    </div>
  )
}
