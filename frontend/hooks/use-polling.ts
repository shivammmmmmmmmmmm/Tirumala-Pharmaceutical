'use client'

import { useEffect, useRef } from 'react'

/** Refetch data on an interval for live order/dashboard updates */
export function usePolling(callback: () => void, intervalMs = 15000, enabled = true) {
  const saved = useRef(callback)
  saved.current = callback

  useEffect(() => {
    if (!enabled) return
    saved.current()
    const id = setInterval(() => saved.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
