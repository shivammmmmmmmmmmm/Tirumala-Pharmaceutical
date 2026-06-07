'use client'

import { useRef, useState } from 'react'

export interface PickedLocation {
  latitude: number
  longitude: number
  address?: string
  sourceMode: 'ONLINE' | 'OFFLINE'
}

interface Props {
  value?: PickedLocation | null
  onChange: (loc: PickedLocation) => void
  onClose: () => void
}

// Reverse-geocode with OpenStreetMap Nominatim (free, no key)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

export default function LocationPicker({ value, onChange, onClose }: Props) {
  const [detecting, setDetecting]   = useState(false)
  const [address, setAddress]       = useState(value?.address ?? '')
  const [lat, setLat]               = useState(value?.latitude ?? 0)
  const [lng, setLng]               = useState(value?.longitude ?? 0)
  const [hasLocation, setHasLocation] = useState(!!value)
  const [error, setError]           = useState('')
  const [mode, setMode]             = useState<'current' | 'manual'>(value ? 'current' : 'current')

  // (mapUrl removed — iframe is used directly for reliable full rendering)

  const detectLocation = () => {
    setError('')
    if (!navigator.geolocation) {
      setError('Geolocation not supported in this browser')
      return
    }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setLat(latitude)
        setLng(longitude)
        setHasLocation(true)
        const addr = await reverseGeocode(latitude, longitude)
        setAddress(addr)
        setDetecting(false)
      },
      err => {
        setDetecting(false)
        setError(
          err.code === 1
            ? 'Location access denied. Allow location in browser settings.'
            : 'Could not get location. Try entering manually.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleManual = async () => {
    const latN = parseFloat(String(lat))
    const lngN = parseFloat(String(lng))
    if (isNaN(latN) || isNaN(lngN)) { setError('Enter valid coordinates'); return }
    setHasLocation(true)
    const addr = await reverseGeocode(latN, lngN)
    setAddress(addr)
  }

  const confirm = () => {
    onChange({ latitude: lat, longitude: lng, address, sourceMode: mode === 'current' ? 'ONLINE' : 'OFFLINE' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">📍 Pick Location</h2>
            <p className="text-xs text-slate-400 mt-0.5">Share your territory location</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pb-3 flex gap-2">
          <button onClick={() => setMode('current')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${mode === 'current' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'bg-slate-100 text-slate-600'}`}>
            📡 Current Location
          </button>
          <button onClick={() => setMode('manual')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${mode === 'manual' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'bg-slate-100 text-slate-600'}`}>
            ✏️ Enter Manually
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">{error}</div>
          )}

          {mode === 'current' ? (
            /* WhatsApp-style current location button */
            <button onClick={detectLocation} disabled={detecting}
              className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] border border-blue-100 rounded-2xl transition-all group">
              <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 ${detecting ? 'animate-pulse' : ''}`}>
                {detecting ? (
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="white" strokeOpacity="0.3" strokeWidth="3"/>
                    <path d="M12 3A9 9 0 0 1 21 12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                )}
              </div>
              <div className="text-left">
                <p className="font-bold text-blue-800 text-sm">
                  {detecting ? 'Getting your location…' : 'Use Current Location'}
                </p>
                <p className="text-xs text-blue-500 mt-0.5">
                  {detecting ? 'Please wait…' : 'Accurate GPS position'}
                </p>
              </div>
            </button>
          ) : (
            /* Manual entry */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Latitude</label>
                  <input type="number" step="any" value={lat || ''}
                    onChange={e => setLat(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 28.6139"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Longitude</label>
                  <input type="number" step="any" value={lng || ''}
                    onChange={e => setLng(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 77.2090"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"/>
                </div>
              </div>
              <button onClick={handleManual}
                className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition">
                Look up address →
              </button>
            </div>
          )}

          {/* Map preview */}
          {hasLocation && (
            <div className="space-y-2">
              {/* Address chip */}
              <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg shrink-0">📍</span>
                <p className="text-xs text-slate-700 leading-relaxed">{address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</p>
              </div>

              {/* Map — iframe taller than container + shifted up to hide OSM toolbar */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100"
                style={{ height: 240 }}>
                <iframe
                  key={`${lat}-${lng}`}
                  title="map"
                  style={{
                    position: 'absolute',
                    top: '-50px',      /* hides the OSM embed toolbar */
                    left: 0,
                    width: '100%',
                    height: 'calc(100% + 50px)',  /* compensate for the offset */
                    border: 'none',
                  }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.012},${lat - 0.012},${lng + 0.012},${lat + 0.012}&layer=mapnik&marker=${lat},${lng}`}
                  allowFullScreen
                />
                {/* Center pin overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center drop-shadow-lg">
                    <div className="h-8 w-8 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
                      <div className="h-2.5 w-2.5 bg-white rounded-full" />
                    </div>
                    <div className="h-3 w-0.5 bg-red-500/70" />
                    <div className="h-1.5 w-3 bg-black/20 rounded-full blur-sm" />
                  </div>
                </div>
                {/* Open in Maps link */}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="absolute bottom-2 right-2 px-2.5 py-1 bg-white/90 backdrop-blur rounded-lg text-xs font-semibold text-blue-600 shadow hover:bg-white transition"
                  onClick={e => e.stopPropagation()}>
                  Open in Maps ↗
                </a>
              </div>
            </div>
          )}

          {/* Confirm button */}
          {hasLocation && (
            <button onClick={confirm}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 transition-all active:scale-[0.98] text-sm">
              ✅ Confirm Location
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
