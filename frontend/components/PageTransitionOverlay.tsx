'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Tiny overlay that appears immediately when any Link is clicked,
// before Next.js has compiled/loaded the new page chunk.
export default function PageTransitionOverlay() {
  const pathname  = usePathname()
  const [show, setShow]     = useState(false)
  const prevPath  = useRef(pathname)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef  = useRef<HTMLVideoElement | null>(null)

  // When a link is clicked, show immediately via global click capture
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const anchor = (e.target as Element)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      // Only internal same-origin navigation
      if (href.startsWith('/') && !href.startsWith('//')) {
        if (href !== window.location.pathname) {
          setShow(true)
          // Play the video from start each time
          if (videoRef.current) {
            videoRef.current.currentTime = 0
            videoRef.current.play().catch(() => {})
          }
          // Safety auto-hide after 8s if navigation never completes
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setShow(false), 8000)
        }
      }
    }
    document.addEventListener('click', handler, { capture: true, passive: true })
    document.addEventListener('touchend', handler, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', handler, { capture: true })
      document.removeEventListener('touchend', handler, { capture: true })
    }
  }, [])

  // Hide when route actually changes
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      if (timerRef.current) clearTimeout(timerRef.current)
      setShow(false)
    }
  }, [pathname])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Loading video animation */}
        <video
          ref={videoRef}
          src="/loading.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="w-32 h-32 sm:w-40 sm:h-40 object-contain"
        />
        <p className="text-sm font-semibold text-slate-600 tracking-wide animate-pulse">
          Loading…
        </p>
      </div>
    </div>
  )
}