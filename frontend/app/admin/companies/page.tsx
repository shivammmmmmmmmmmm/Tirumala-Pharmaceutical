'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useRouter } from 'next/navigation'
import { companiesApi } from '@/lib/api'
import type { Company } from '@/lib/types'

const EMPTY: Partial<Company> = {
  name: '', mfgCode: '', address: '', city: '', phone: '',
  orderPct1: 0, orderPct2: 0, orderPct3: 0, orderFactor: 1,
  stopOperations: false, allowMobileAnalysis: false,
  mrMobile: '', mrEmail: '', asmMobile: '', asmEmail: '', rsmMobile: '', rsmEmail: '',
  isActive: true,
}

export default function CompaniesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState<Partial<Company>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const load = useCallback(async () => {
    setLoading(true)
    try { setCompanies(await companiesApi.list({ search: search || undefined, activeOnly: false })) }
    catch (e: any) { console.error(e) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, load])

  const openNew  = () => { setEditing(null); setForm(EMPTY); setError(''); setShowForm(true) }
  const openEdit = (c: Company) => { setEditing(c); setForm({ ...c }); setError(''); setShowForm(true) }

  const set = (k: keyof Company, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editing) await companiesApi.update(editing.id, form)
      else await companiesApi.create(form)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleActive = async (c: Company) => {
    try { await companiesApi.update(c.id, { isActive: !c.isActive }); load() }
    catch (e: any) { alert(e.message) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</label>{children}</div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">{companies.length} companies</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
          + Add Company
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…"
        className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-10">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Company' : 'Add Company'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company Name *"><input className={inp} value={form.name || ''} onChange={e => set('name', e.target.value)} required /></Field>
                <Field label="MFG Code"><input className={inp} value={form.mfgCode || ''} onChange={e => set('mfgCode', e.target.value)} /></Field>
                <Field label="City"><input className={inp} value={form.city || ''} onChange={e => set('city', e.target.value)} /></Field>
                <Field label="Phone"><input className={inp} value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Address"><textarea className={inp} rows={2} value={form.address || ''} onChange={e => set('address', e.target.value)} /></Field>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Order Percentages & Factor</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Order % 1"><input className={inp} type="number" step="0.01" value={form.orderPct1 ?? 0} onChange={e => set('orderPct1', parseFloat(e.target.value))} /></Field>
                  <Field label="Order % 2"><input className={inp} type="number" step="0.01" value={form.orderPct2 ?? 0} onChange={e => set('orderPct2', parseFloat(e.target.value))} /></Field>
                  <Field label="Order % 3"><input className={inp} type="number" step="0.01" value={form.orderPct3 ?? 0} onChange={e => set('orderPct3', parseFloat(e.target.value))} /></Field>
                  <Field label="Order Factor"><input className={inp} type="number" step="0.0001" value={form.orderFactor ?? 1} onChange={e => set('orderFactor', parseFloat(e.target.value))} /></Field>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Contact Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="MR Mobile"><input className={inp} value={form.mrMobile || ''} onChange={e => set('mrMobile', e.target.value)} /></Field>
                  <Field label="MR Email"><input className={inp} type="email" value={form.mrEmail || ''} onChange={e => set('mrEmail', e.target.value)} /></Field>
                  <Field label="ASM Mobile"><input className={inp} value={form.asmMobile || ''} onChange={e => set('asmMobile', e.target.value)} /></Field>
                  <Field label="ASM Email"><input className={inp} type="email" value={form.asmEmail || ''} onChange={e => set('asmEmail', e.target.value)} /></Field>
                  <Field label="RSM Mobile"><input className={inp} value={form.rsmMobile || ''} onChange={e => set('rsmMobile', e.target.value)} /></Field>
                  <Field label="RSM Email"><input className={inp} type="email" value={form.rsmEmail || ''} onChange={e => set('rsmEmail', e.target.value)} /></Field>
                </div>
              </div>

              <div className="border-t pt-4 flex flex-wrap gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.stopOperations} onChange={e => set('stopOperations', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Stop Company Operations</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.allowMobileAnalysis} onChange={e => set('allowMobileAnalysis', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Allow Analysis on Mobile App</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.isActive} onChange={e => set('isActive', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Company'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Company', 'MFG Code', 'City', 'Phone', 'MR Contact', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {companies.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No companies found</td></tr>
              ) : companies.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    {c.address && <p className="text-xs text-gray-400 truncate max-w-[180px]">{c.address}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.mfgCode || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    {c.mrMobile && <p className="text-xs text-gray-600">📱 {c.mrMobile}</p>}
                    {c.mrEmail  && <p className="text-xs text-gray-400">{c.mrEmail}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {c.stopOperations && <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Stopped</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition font-medium">Edit</button>
                      <button onClick={() => toggleActive(c)}
                        className={`px-2 py-1 text-xs rounded transition font-medium ${c.isActive ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
