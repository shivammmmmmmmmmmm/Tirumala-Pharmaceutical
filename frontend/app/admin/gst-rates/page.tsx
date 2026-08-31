'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useRouter } from 'next/navigation'
import { gstRatesApi } from '@/lib/api'
import type { GstRate } from '@/lib/types'

export default function GstRatesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<GstRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GstRate | null>(null)
  const [form, setForm] = useState({ name: '', code: '', percentage: '', isActive: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await gstRatesApi.list(false)) }
    catch (e: any) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, load])

  const openNew = () => { setEditing(null); setForm({ name: '', code: '', percentage: '', isActive: true }); setError(''); setShowForm(true) }
  const openEdit = (g: GstRate) => { setEditing(g); setForm({ name: g.name, code: g.code || '', percentage: String(g.percentage), isActive: g.isActive }); setError(''); setShowForm(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { name: form.name, code: form.code || undefined, percentage: parseFloat(form.percentage) || 0, isActive: form.isActive }
      if (editing) await gstRatesApi.update(editing.id, payload)
      else await gstRatesApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleActive = async (g: GstRate) => {
    try { await gstRatesApi.update(g.id, { isActive: !g.isActive }); load() }
    catch (e: any) { alert(e.message) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Rates Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} GST rates</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
          + Add GST Rate
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit GST Rate' : 'Add GST Rate'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Name *</label>
                <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. GST 12%" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Code</label>
                <input className={inp} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. GST12" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Percentage (%) *</label>
                <input className={inp} type="number" step="0.01" min="0" max="100" value={form.percentage}
                  onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} required />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm">
                  {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Name', 'Code', 'Percentage', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No GST rates found</td></tr>
              ) : items.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{g.code || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg font-semibold text-sm">{g.percentage}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(g)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium">Edit</button>
                      <button onClick={() => toggleActive(g)}
                        className={`px-2 py-1 text-xs rounded font-medium ${g.isActive ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        {g.isActive ? 'Deactivate' : 'Activate'}
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
