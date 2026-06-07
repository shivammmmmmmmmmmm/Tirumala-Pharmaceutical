'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { areasApi } from '@/lib/api'
import LocationPicker, { PickedLocation } from '@/components/LocationPicker'

type Area = { id: string; name: string; description?: string; latitude?: number | null; longitude?: number | null; sourceMode?: 'ONLINE' | 'OFFLINE' | null }

export default function AdminAreasPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [areas, setAreas]           = useState<Area[]>([])
  const [name, setName]             = useState('')
  const [desc, setDesc]             = useState('')
  const [pickedLoc, setPickedLoc]   = useState<PickedLocation | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const load = async () => setAreas(await areasApi.list())

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
    else if (user?.role === 'ADMIN') load()
  }, [user, authLoading, router])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Area name is required'); return }
    setError(''); setSaving(true)
    try {
      await areasApi.create({
        name: name.trim(),
        description: desc || undefined,
        latitude:  pickedLoc?.latitude  ?? null,
        longitude: pickedLoc?.longitude ?? null,
        sourceMode: pickedLoc?.sourceMode ?? 'ONLINE',
      })
      setName(''); setDesc(''); setPickedLoc(null)
      load()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (authLoading || !user) return null

  return (
    <div className="space-y-6">
      {showPicker && (
        <LocationPicker
          value={pickedLoc}
          onChange={loc => setPickedLoc(loc)}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Territory Management</h1>
        <p className="text-sm text-slate-500 mt-1">Define sales territories with map-based location</p>
      </div>

      {/* Add area form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-4">Add New Territory</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={create} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Territory Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                placeholder="e.g. North Delhi Zone"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all" />
            </div>
          </div>

          {/* Location section */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Location (optional)</label>
            {pickedLoc ? (
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="text-2xl shrink-0">📍</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800 truncate">
                    {pickedLoc.address || `${pickedLoc.latitude?.toFixed(5)}, ${pickedLoc.longitude?.toFixed(5)}`}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {pickedLoc.sourceMode === 'ONLINE' ? '📡 GPS' : '✏️ Manual'} ·
                    {pickedLoc.latitude?.toFixed(5)}, {pickedLoc.longitude?.toFixed(5)}
                  </p>
                </div>
                <button type="button" onClick={() => setShowPicker(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowPicker(true)}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 rounded-xl transition-all group">
                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-blue-700">Add Location</p>
                  <p className="text-xs text-slate-400">GPS or manual coordinates with map preview</p>
                </div>
              </button>
            )}
          </div>

          <button type="submit" disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-60">
            {saving ? 'Adding…' : '+ Add Territory'}
          </button>
        </form>
      </div>

      {/* Areas list */}
      {areas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">🗺️</span>
          <p className="font-semibold text-slate-600">No territories yet</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areas.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Mini map */}
              {a.latitude && a.longitude ? (
                <div className="h-28 bg-slate-100 relative overflow-hidden">
                  <iframe
                    title={a.name}
                    className="w-full h-full border-0 pointer-events-none"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${a.longitude - 0.008},${a.latitude - 0.008},${a.longitude + 0.008},${a.latitude + 0.008}&layer=mapnik&marker=${a.latitude},${a.longitude}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <a href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=15/${a.latitude}/${a.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 px-2 py-0.5 bg-white/90 rounded text-[10px] font-semibold text-blue-600">
                    Open ↗
                  </a>
                </div>
              ) : (
                <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <span className="text-3xl opacity-40">🗺️</span>
                </div>
              )}
              <div className="p-4">
                <p className="font-bold text-slate-800">{a.name}</p>
                {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                {a.latitude && a.longitude && (
                  <p className="text-[11px] text-slate-400 mt-2 font-mono">
                    {a.sourceMode === 'ONLINE' ? '📡' : '✏️'} {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
