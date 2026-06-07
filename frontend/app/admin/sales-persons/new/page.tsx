'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi, areasApi } from '@/lib/api'
import FileUpload from '@/components/FileUpload'

export default function NewSalesPersonPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '', territory: '', commissionPct: '5',
    areaId: '', bankAccount: '', bankIfsc: '', bankName: '',
  })
  const [aadhaarDataUrl, setAadhaar] = useState('')
  const [photoDataUrl, setPhoto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
    areasApi.list().then(setAreas).catch(() => {})
  }, [user, authLoading, router])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await usersApi.create({
        ...form,
        newRole: 'SALES_PERSON',
        commissionPct: parseFloat(form.commissionPct) || 0,
        aadhaarDataUrl: aadhaarDataUrl || undefined,
        photoDataUrl: photoDataUrl || undefined,
      })
      router.push('/admin/sales-persons')
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Add Sales Person</h1>
        <div className="bg-white rounded-xl border p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Full Name *</label><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required /></div>
              <div><label className="block text-sm font-medium mb-1">Email *</label><input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
              <div><label className="block text-sm font-medium mb-1">Password *</label><input className={inp} type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div>
                <label className="block text-sm font-medium mb-1">Assigned area</label>
                <select className={inp} value={form.areaId} onChange={e => set('areaId', e.target.value)}>
                  <option value="">— Select —</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Territory label</label><input className={inp} value={form.territory} onChange={e => set('territory', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1">Commission %</label><input className={inp} type="number" value={form.commissionPct} onChange={e => set('commissionPct', e.target.value)} /></div>
            </div>
            <h3 className="font-medium text-gray-900 pt-2">Bank details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Bank name</label><input className={inp} value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1">Account number</label><input className={inp} value={form.bankAccount} onChange={e => set('bankAccount', e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1">IFSC</label><input className={inp} value={form.bankIfsc} onChange={e => set('bankIfsc', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FileUpload label="Aadhaar (PDF/image)" onFile={(d) => setAadhaar(d)} />
              <FileUpload label="Photo" onFile={(d) => setPhoto(d)} accept="image/*" />
            </div>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">{saving ? 'Creating…' : 'Create Sales Person'}</button>
          </form>
        </div>
      </div>
  )
}
