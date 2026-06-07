'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { spTerritoriesApi } from '@/lib/api'
import LeafletMap from '@/components/LeafletMap'

interface Territory {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  notes?: string
  isActive: boolean
  createdAt: string
}

export default function SpTerritoriesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [territories, setTerritories] = useState<Territory[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState<Territory | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')

  const loadTerritories = useCallback(async () => {
    try {
      const data = await spTerritoriesApi.list()
      setTerritories(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') loadTerritories()
  }, [user?.role, loadTerritories])

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }
    setGettingLocation(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setGettingLocation(false)
      },
      (error) => {
        setGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please enable GPS/location access in your browser settings.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('GPS signal unavailable. Please check your location settings and try again.')
            break
          case error.TIMEOUT:
            setLocationError('Location request timed out. Please ensure you have a clear view of the sky and try again.')
            break
          default:
            setLocationError('Failed to retrieve location. Please try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const resetForm = () => {
    setName('')
    setAddress('')
    setLatitude(null)
    setLongitude(null)
    setNotes('')
    setLocationError('')
  }

  const handleAddTerritory = async () => {
    if (!name.trim()) {
      alert('Please enter a territory name')
      return
    }
    if (latitude == null || longitude == null) {
      alert('Please capture your current location first')
      return
    }
    setSaving(true)
    try {
      await spTerritoriesApi.create({
        name: name.trim(),
        address: address.trim() || undefined,
        latitude,
        longitude,
        notes: notes.trim() || undefined,
      })
      alert('Territory added successfully!')
      setShowAddModal(false)
      resetForm()
      loadTerritories()
    } catch (e: any) {
      alert(e.message || 'Failed to add territory')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTerritory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this territory? This action cannot be undone.')) return
    try {
      await spTerritoriesApi.delete(id)
      setTerritories(prev => prev.filter(t => t.id !== id))
      setShowDetailModal(null)
    } catch (e: any) {
      alert(e.message || 'Failed to delete')
    }
  }

  const openGoogleMapsDirections = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer')
  }

  const openGoogleMapsLocation = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer')
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  return (
    <div className="space-y-6 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Territories</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your service areas with GPS coordinates</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true) }}
          className="btn-press inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Territory
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      ) : territories.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-6 border border-blue-100">
            <svg className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-700">No territories added</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Add your first territory by capturing your current GPS location and giving it a name. Each territory will show on a real interactive map.
          </p>
          <button
            onClick={() => { resetForm(); setShowAddModal(true) }}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Your First Territory
          </button>
        </div>
      ) : (
        /* Territory Cards */
        <div className="grid sm:grid-cols-2 gap-3">
          {territories.map((t) => (
            <div
              key={t.id}
              className="card-hover bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              {/* Real Interactive Map Preview */}
              <button
                onClick={() => openGoogleMapsLocation(t.latitude, t.longitude)}
                className="w-full relative group cursor-pointer block"
              >
                <LeafletMap
                  latitude={t.latitude}
                  longitude={t.longitude}
                  height={160}
                  zoom={14}
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-none" />
                {/* View on Maps badge */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 shadow-sm flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="#4285F4">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  </svg>
                  Open in Google Maps
                </div>
              </button>

              {/* Card Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{t.name}</h3>
                    {t.address && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">{t.address}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </div>

                {t.notes && (
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">{t.notes}</p>
                )}

                {/* Coordinates badge */}
                <div className="mt-2">
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openGoogleMapsDirections(t.latitude, t.longitude)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    </svg>
                    Get Directions
                  </button>
                  <button
                    onClick={() => setShowDetailModal(t)}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD TERRITORY MODAL ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => { setShowAddModal(false); resetForm() }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add New Territory</h2>
                <p className="text-sm text-slate-500 mt-0.5">Capture your current GPS location to mark this area</p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors btn-press"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Location Capture Section */}
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">GPS Location</p>
                    <p className="text-xs text-slate-500">Capture your current position using GPS</p>
                  </div>
                </div>

                {latitude != null && longitude != null ? (
                  <div className="space-y-3">
                    {/* Mini map preview after location captured */}
                    <div className="rounded-xl overflow-hidden border border-emerald-200 shadow-sm">
                      <LeafletMap
                        latitude={latitude}
                        longitude={longitude}
                        height={140}
                        zoom={15}
                      />
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-emerald-800">Location captured</span>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 font-mono text-sm text-slate-700">
                        {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </div>
                      <button
                        onClick={getCurrentLocation}
                        disabled={gettingLocation}
                        className="mt-2 text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors"
                      >
                        {gettingLocation ? 'Updating...' : 'Re-capture location'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={getCurrentLocation}
                      disabled={gettingLocation}
                      className="w-full inline-flex items-center justify-center gap-2.5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
                    >
                      {gettingLocation ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Capturing location...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                            <circle cx="12" cy="9" r="2.5" fill="white" />
                          </svg>
                          Capture Current Location
                        </>
                      )}
                    </button>
                    {locationError && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <p className="text-xs text-red-700">{locationError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Territory Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Territory Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. North Delhi Service Zone"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Sector 12, Rohini, Delhi - 110085"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add any notes about this territory..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleAddTerritory}
                disabled={saving || !name.trim() || latitude == null || longitude == null}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Save Territory
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {showDetailModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowDetailModal(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{showDetailModal.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Territory details & actions</p>
              </div>
              <button
                onClick={() => setShowDetailModal(null)}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors btn-press"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Real Interactive Map */}
              <button
                onClick={() => openGoogleMapsLocation(showDetailModal.latitude, showDetailModal.longitude)}
                className="w-full relative group cursor-pointer block rounded-xl overflow-hidden"
              >
                <LeafletMap
                  latitude={showDetailModal.latitude}
                  longitude={showDetailModal.longitude}
                  height={200}
                  zoom={15}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs font-semibold text-blue-600 shadow-sm flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#4285F4">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  </svg>
                  Open in Google Maps
                </div>
              </button>

              {/* Info Cards */}
              <div className="space-y-3">
                {showDetailModal.address && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Address</p>
                    <p className="text-sm text-slate-800">{showDetailModal.address}</p>
                  </div>
                )}
                {showDetailModal.notes && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm text-slate-800">{showDetailModal.notes}</p>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">GPS Coordinates</p>
                  <p className="text-sm font-mono text-slate-800">
                    {showDetailModal.latitude.toFixed(6)}, {showDetailModal.longitude.toFixed(6)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Added On</p>
                  <p className="text-sm text-slate-800">
                    {new Date(showDetailModal.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => openGoogleMapsDirections(showDetailModal.latitude, showDetailModal.longitude)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  </svg>
                  Get Directions
                </button>
                <button
                  onClick={() => handleDeleteTerritory(showDetailModal.id)}
                  className="inline-flex items-center justify-center gap-2 py-3 px-5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">About Territories</p>
            <ul className="text-xs text-slate-500 mt-1.5 space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-slate-400" />
                Capture your current GPS location to register a service territory
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-slate-400" />
                Use "Get Directions" to navigate to any territory via Google Maps
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-slate-400" />
                You can add an unlimited number of territories
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}