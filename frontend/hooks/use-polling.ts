'use client'

import { useEffect, useRef } from 'react'

/** Refetch on interval only when tab is visible (reduces load & improves navigation speed) */
export function usePolling(callback: () => void, intervalMs = 30000, enabled = true) {
  const saved = useRef(callback)
  saved.current = callback

  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      saved.current()
    }
    tick()
    const id = setInterval(tick, intervalMs)
    const onVisible = () => tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, enabled])
}
