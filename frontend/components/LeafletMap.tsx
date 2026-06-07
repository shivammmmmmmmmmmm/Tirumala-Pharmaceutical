'use client'

import { useEffect, useRef, useState } from 'react'

interface LeafletMapProps {
  latitude: number
  longitude: number
  height?: number
  zoom?: number
  interactive?: boolean
  onMapReady?: () => void
}

function StaticMapImage({ lat, lng }: { lat: number; lng: number }) {
  // Generate a pseudo-random road-like pattern based on coordinates for a map feel
  const seed = Math.abs(lat * 7 + lng * 13)
  const roadHues = [40, 45, 50, 55]
  const roadCount = 6
  const roads = Array.from({ length: roadCount }, (_, i) => {
    const hue = roadHues[i % roadHues.length]
    const x1 = ((seed * (i + 1) * 37) % 100)
    const y1 = ((seed * (i + 1) * 53) % 100)
    const x2 = ((seed * (i + 1) * 71) % 100)
    const y2 = ((seed * (i + 1) * 89) % 100)
    const width = 1 + (i % 3)
    return { x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%`, width, hue }
  })

  // Grid lines
  const gridLines = Array.from({ length: 8 }, (_, i) => ({
    pos: `${(i + 1) * 12.5}%`,
    opacity: 0.03 + (i % 3) * 0.02,
  }))

  return (
    <svg
      className="w-full h-full"
      viewBox="0 0 400 200"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="map-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f4f8" />
          <stop offset="100%" stopColor="#d4e8f0" />
        </linearGradient>
        <filter id="map-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Base terrain */}
      <rect width="400" height="200" fill="url(#map-sky)" />

      {/* Grid lines */}
      {gridLines.map((g, i) => (
        <g key={`grid-${i}`}>
          <line x1={g.pos} y1="0" x2={g.pos} y2="100%" stroke="#8ba0b0" strokeWidth="0.3" opacity={g.opacity} />
          <line x1="0" y1={g.pos} x2="100%" y2={g.pos} stroke="#8ba0b0" strokeWidth="0.3" opacity={g.opacity} />
        </g>
      ))}

      {/* Parks / green areas */}
      <rect x="15%" y="20%" width="18%" height="15%" rx="4" fill="#c8e6c9" opacity="0.35" />
      <rect x="65%" y="55%" width="22%" height="20%" rx="5" fill="#c8e6c9" opacity="0.3" />

      {/* Water body */}
      <ellipse cx="82%" cy="25%" rx="10%" ry="8%" fill="#bbdefb" opacity="0.25" />

      {/* Roads */}
      {roads.map((r, i) => (
        <line
          key={`road-${i}`}
          x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke={`hsl(${r.hue}, 8%, 65%)`}
          strokeWidth={r.width * 1.5}
          strokeLinecap="round"
          opacity={0.4}
        />
      ))}

      {/* Major roads */}
      <line x1="0%" y1="50%" x2="100%" y2="48%" stroke="#f5f0e8" strokeWidth="3" opacity="0.5" />
      <line x1="40%" y1="0%" x2="42%" y2="100%" stroke="#f5f0e8" strokeWidth="2.5" opacity="0.45" />
      <line x1="20%" y1="0%" x2="22%" y2="100%" stroke="#f5f0e8" strokeWidth="2" opacity="0.35" />

      {/* Map pin at center */}
      <g transform="translate(200, 80)" filter="url(#map-shadow)">
        {/* Pin shadow */}
        <ellipse cx="0" cy="28" rx="10" ry="3" fill="rgba(0,0,0,0.12)" />
        {/* Pin body */}
        <path d="M0 -28 C-10 -28 -16 -18 -16 -8 C-16 4 0 20 0 20 C0 20 16 4 16 -8 C16 -18 10 -28 0 -28Z" fill="#ea4335" />
        {/* Pin inner circle */}
        <circle cx="0" cy="-10" r="6" fill="white" />
      </g>

      {/* Location badge */}
      <rect x="135" y="150" width="130" height="22" rx="11" fill="rgba(0,0,0,0.55)" />
      <text x="200" y="164" textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace" fontWeight="500">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </text>
    </svg>
  )
}

export default function LeafletMap({
  latitude,
  longitude,
  height = 200,
  zoom = 15,
  interactive = false,
  onMapReady,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const initializedRef = useRef(false)
  const [leafletReady, setLeafletReady] = useState(false)
  const [showStatic, setShowStatic] = useState(true)

  useEffect(() => {
    if (initializedRef.current) return
    if (!containerRef.current) return

    let cancelled = false

    async function initMap() {
      try {
        const leaflet = await import('leaflet')
        if (cancelled) return

        const L = leaflet.default || leaflet

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        if (cancelled || !containerRef.current) return

        const map = L.map(containerRef.current, {
          center: [latitude, longitude],
          zoom,
          zoomControl: interactive,
          scrollWheelZoom: interactive,
          dragging: interactive,
          touchZoom: interactive,
          doubleClickZoom: interactive,
          boxZoom: interactive,
          keyboard: false,
          attributionControl: false,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map)

        // Blue WhatsApp-style pin
        const whatsappPinHtml = `
          <div style="position: relative; width: 22px; height: 22px;">
            <div class="bb-wa-ring" style="position:absolute; inset:0; border-radius:9999px; background:rgba(0,187,255,0.18); transform:scale(0.85);"></div>
            <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="position:absolute; left:0; top:0;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#00B2FF"/>
              <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
            </svg>
          </div>
          <style>
            .bb-wa-ring{ animation: bbWaPulse 1.6s ease-out infinite; }
            @keyframes bbWaPulse{
              0%{ opacity: 0.55; transform: scale(0.7); }
              70%{ opacity: 0.0; transform: scale(1.9); }
              100%{ opacity: 0.0; transform: scale(2.1); }
            }
          </style>
        `

        const divIcon = L.divIcon({
          className: '',
          html: whatsappPinHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        })

        markerRef.current = L.marker([latitude, longitude], { icon: divIcon }).addTo(map)

        mapInstanceRef.current = map
        initializedRef.current = true
        setLeafletReady(true)
        onMapReady?.()

        // Hide static map after a short delay to allow tiles to load
        setTimeout(() => {
          setShowStatic(false)
          try { map.invalidateSize() } catch { /* ignore */ }
        }, 600)
      } catch (err) {
        console.error('Failed to load Leaflet map:', err)
      }
    }

    initMap()

    return () => {
      cancelled = true
      initializedRef.current = false
      markerRef.current = null

      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove() } catch { /* ignore */ }
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Sync map center when props change (for list of territories)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    try {
      map.setView([latitude, longitude], zoom)
      if (markerRef.current) markerRef.current.setLatLng([latitude, longitude])
      setTimeout(() => { try { map.invalidateSize() } catch { /* ignore */ } }, 0)
    } catch { /* ignore */ }
  }, [latitude, longitude, zoom])

  // Sync interactivity
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    try {
      map.options.zoomControl = interactive
      map.scrollWheelZoom?.[interactive ? 'enable' : 'disable']?.()
      map.dragging?.[interactive ? 'enable' : 'disable']?.()
      map.touchZoom?.[interactive ? 'enable' : 'disable']?.()
      map.doubleClickZoom?.[interactive ? 'enable' : 'disable']?.()
      map.boxZoom?.[interactive ? 'enable' : 'disable']?.()
    } catch { /* ignore */ }
  }, [interactive])

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      {/* Static map background - renders instantly, no load delay */}
      <div
        className={`absolute inset-0 z-[1] transition-opacity duration-500 ${showStatic ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <StaticMapImage lat={latitude} lng={longitude} />
      </div>

      {/* Leaflet map container (hidden until static shows, then fades in) */}
      <div
        ref={containerRef}
        className={`w-full h-full z-[2] transition-opacity duration-500 ${leafletReady ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}