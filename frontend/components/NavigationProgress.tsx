'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible]   = useState(false)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPath  = useRef(pathname)

  // Start bar when pathname changes (navigation started)
  useEffect(() => {
    if (pathname === prevPath.current) return
    prevPath.current = pathname

    // Show instantly
    setVisible(true)
    setProgress(15)

    // Crawl toward 90% (never quite gets there until done)
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(timerRef.current!); return 85 }
        return p + Math.random() * 12
      })
    }, 200)

    // Complete after a tick
    const done = setTimeout(() => {
      clearInterval(timerRef.current!)
      setProgress(100)
      setTimeout(() => { setVisible(false); setProgress(0) }, 300)
    }, 600)

    return () => { clearInterval(timerRef.current!); clearTimeout(done) }
  }, [pathname])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none">
      <div
        className="h-full rounded-r-full shadow-lg"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)',
          transition: progress === 100 ? 'width 0.15s ease' : 'width 0.25s ease',
          boxShadow: '0 0 8px rgba(99,102,241,0.6)',
        }}
      />
    </div>
  )
}
