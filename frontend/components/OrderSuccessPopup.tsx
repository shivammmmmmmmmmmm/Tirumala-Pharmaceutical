'use client'

import { useEffect, useState } from 'react'

interface Props {
  orderNumber?: string
  onClose: () => void
}

export default function OrderSuccessPopup({ orderNumber, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Mount → play enter animation
    const t1 = setTimeout(() => setVisible(true), 10)
    // Auto-close after 3.5 s
    const t2 = setTimeout(() => close(), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const close = () => {
    setLeaving(true)
    setTimeout(onClose, 400)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 transition-all duration-300 ${
        visible && !leaving ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent'
      }`}
      onClick={close}
    >
      <div
        className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-400 ${
          visible && !leaving
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-8'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Animated green top band */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 animate-pulse" />

        {/* Confetti dots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full opacity-60"
              style={{
                background: ['#34d399','#60a5fa','#f59e0b','#a78bfa','#f472b6'][i % 5],
                left: `${8 + i * 7.5}%`,
                top: `${10 + (i % 3) * 25}%`,
                animation: `confettiFall ${0.8 + (i % 4) * 0.3}s ease-out ${i * 0.05}s both`,
              }}
            />
          ))}
        </div>

        <div className="px-8 py-8 text-center relative">
          {/* Animated checkmark circle */}
          <div className="relative mx-auto mb-5 h-20 w-20">
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-20 animate-ping" style={{ animationDuration: '1.2s' }} />
            {/* Circle */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-500/30">
              <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M20 6L9 17l-5-5"
                  style={{
                    strokeDasharray: 28,
                    strokeDashoffset: visible ? 0 : 28,
                    transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1) 0.2s',
                  }}
                />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Order Placed!</h2>
          {orderNumber && (
            <p className="text-sm font-semibold text-slate-500 mb-1">
              Order <span className="text-blue-600">{orderNumber}</span>
            </p>
          )}
          <p className="text-sm text-slate-400 mb-6">
            Your order has been placed successfully and is now pending approval.
          </p>

          <button
            onClick={close}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-95"
          >
            Got it 🎉
          </button>
        </div>

        {/* Progress bar auto-close indicator */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
            style={{
              width: visible ? '0%' : '100%',
              transition: visible ? 'width 3.5s linear' : 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes confettiFall {
          from { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          to   { transform: translateY(60px) rotate(180deg); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
