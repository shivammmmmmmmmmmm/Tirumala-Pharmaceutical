'use client'

import { useEffect } from 'react'

export default function TapFeedback() {
  useEffect(() => {
    // Inject ripple on every button/link tap
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes ripple-out {
        from { transform: scale(0); opacity: 0.35; }
        to   { transform: scale(3); opacity: 0; }
      }
      .tap-ripple {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        background: currentColor;
        width: 60px; height: 60px;
        margin-left: -30px; margin-top: -30px;
        animation: ripple-out 0.45s cubic-bezier(0.4,0,0.2,1) forwards;
      }
    `
    document.head.appendChild(style)

    const handler = (e: MouseEvent | TouchEvent) => {
      const target = (e.target as Element)?.closest('button, a, [role="button"]') as HTMLElement | null
      if (!target) return

      // Make parent non-static for ripple positioning
      const pos = window.getComputedStyle(target).position
      if (pos === 'static') target.style.position = 'relative'
      target.style.overflow = 'hidden'

      const rect = target.getBoundingClientRect()
      const x = e instanceof TouchEvent
        ? e.touches[0].clientX - rect.left
        : (e as MouseEvent).clientX - rect.left
      const y = e instanceof TouchEvent
        ? e.touches[0].clientY - rect.top
        : (e as MouseEvent).clientY - rect.top

      const ripple = document.createElement('span')
      ripple.className = 'tap-ripple'
      ripple.style.left = `${x}px`
      ripple.style.top  = `${y}px`
      ripple.style.opacity = '0.15'
      target.appendChild(ripple)
      setTimeout(() => ripple.remove(), 500)
    }

    document.addEventListener('mousedown', handler, { passive: true })
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
      document.head.removeChild(style)
    }
  }, [])

  return null
}
