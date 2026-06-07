'use client'

import { useRef, useEffect } from 'react'

// Full-screen loading animation used by AppShell and auth guards
export default function Loader({ label }: { label?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      {/* Loading video */}
      <video
        ref={videoRef}
        src="/loading.mp4"
        muted
        loop
        playsInline
        className="w-40 h-40 sm:w-48 sm:h-48 object-contain"
      />
      <p className="text-sm font-semibold text-slate-600 tracking-wide mt-4">
        {label ?? 'Loading…'}
      </p>
      <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
        <img src="/tirumala-logo.svg" alt="Tirumala Pharmaceutical" className="h-4 w-4" />
        Tirumala Pharmaceutical
      </p>
    </div>
  )
}

// Inline small spinner for button / card loading states
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 3 A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// Skeleton card shimmer with video while data loads
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex justify-center py-4">
        <video
          src="/loading.mp4"
          muted
          loop
          autoPlay
          playsInline
          className="w-16 h-16 object-contain"
        />
      </div>
      <div className="space-y-2 mt-2">
        <div className="skeleton h-4 w-2/5 rounded" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ width: `${70 + Math.random() * 25}%` }} />
        ))}
      </div>
    </div>
  )
}

// Skeleton for stats row
export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex justify-center mb-2">
            <video
              src="/loading.mp4"
              muted
              loop
              autoPlay
              playsInline
              className="w-10 h-10 object-contain"
            />
          </div>
          <div className="skeleton h-7 w-24 rounded mx-auto" />
        </div>
      ))}
    </div>
  )
}