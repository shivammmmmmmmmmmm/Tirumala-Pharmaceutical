'use client'

import { useRef, useState, useCallback } from 'react'

interface Props {
  label: string
  onFile: (dataUrl: string, fileName?: string) => void
  accept?: string
  capture?: 'user' | 'environment'
}

// ── Camera Modal ─────────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const startCamera = useCallback(async (node: HTMLVideoElement | null) => {
    if (!node) return
    ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      node.srcObject = stream
      node.onloadedmetadata = () => { node.play(); setReady(true) }
    } catch {
      setError('Could not access camera. Make sure you grant camera permission.')
    }
  }, [])

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const handleClose = () => { stop(); onClose() }

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    stop()
    onCapture(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Capture Photo
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Video / Error */}
        <div className="relative bg-black aspect-video flex items-center justify-center">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-8 text-center">
              <svg className="h-10 w-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={startCamera}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="h-8 w-8 rounded-full border-4 border-gray-600 border-t-blue-400 animate-spin" />
                </div>
              )}
              {/* Viewfinder corners */}
              {ready && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute top-4 left-4 h-8 w-8 border-t-2 border-l-2 border-white/70 rounded-tl-sm" />
                  <div className="absolute top-4 right-4 h-8 w-8 border-t-2 border-r-2 border-white/70 rounded-tr-sm" />
                  <div className="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-white/70 rounded-bl-sm" />
                  <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-white/70 rounded-br-sm" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50">
          <button onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          {!error && (
            <button
              onClick={handleCapture}
              disabled={!ready}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-blue-500/25"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="3"/>
                <path d="M6.343 6.343A8 8 0 1 0 17.657 17.657"/>
              </svg>
              Take Photo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FileUpload ────────────────────────────────────────────────────────────────
export default function FileUpload({ label, onFile, accept = 'image/*,.pdf', capture }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showCamera, setShowCamera] = useState(false)
  const isCamera = capture === 'environment' || capture === 'user'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = () => onFile(String(reader.result), file.name)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCameraCapture = (dataUrl: string) => {
    setShowCamera(false)
    onFile(dataUrl, `capture-${Date.now()}.jpg`)
  }

  const handleClick = () => {
    if (isCamera) {
      // On mobile the native capture works fine; on desktop open the modal
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      if (isMobile) {
        inputRef.current?.click()
      } else {
        setShowCamera(true)
      }
    } else {
      inputRef.current?.click()
    }
  }

  return (
    <>
      {/* Hidden file input (used for gallery + mobile camera) */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={isCamera ? capture : undefined}
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Styled button */}
      <button
        type="button"
        onClick={handleClick}
        className="group relative w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-sm font-medium text-gray-600 transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {isCamera ? (
          <svg className="h-5 w-5 shrink-0 text-gray-400 transition-colors duration-200 group-hover:text-blue-500"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        ) : (
          <svg className="h-5 w-5 shrink-0 text-gray-400 transition-colors duration-200 group-hover:text-blue-500"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        )}
        <span>{label}</span>
        <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-1 ring-inset ring-blue-400 transition-opacity duration-200 group-hover:opacity-100" />
      </button>

      {/* Camera modal (desktop only) */}
      {showCamera && (
        <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
    </>
  )
}
