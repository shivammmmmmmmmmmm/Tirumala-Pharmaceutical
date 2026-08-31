'use client'

import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  onAddNew?: (name: string) => Promise<void>
  addNewLabel?: string
}

export default function SearchableSelect({
  options, value, onChange, placeholder = 'Select…', disabled = false, className = '',
  onAddNew, addNewLabel = 'Add new',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const handleSelect = (v: string) => { onChange(v); setOpen(false); setQuery('') }
  const handleClear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(''); setQuery('') }

  const handleAddNew = async () => {
    if (!onAddNew || !query.trim()) return
    setAdding(true)
    try { await onAddNew(query.trim()); setOpen(false); setQuery('') }
    finally { setAdding(false) }
  }

  const showAddNew = onAddNew && query.trim().length >= 2 && filtered.length === 0

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(v => !v) }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-all
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500'}
          ${open ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}`}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span onClick={handleClear}
              className="h-4 w-4 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs leading-none transition-colors">
              ×
            </span>
          )}
          <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
                if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].value)
                if (e.key === 'Enter' && showAddNew) handleAddNew()
              }}
              placeholder="Search…"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !showAddNew && (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">No results</li>
            )}
            {filtered.map((opt, index) => (
              <li key={`${opt.value}-${index}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 hover:text-blue-700
                    ${opt.value === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
            {showAddNew && (
              <li>
                <button
                  type="button"
                  disabled={adding}
                  onClick={handleAddNew}
                  className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {adding ? 'Adding…' : `${addNewLabel} "${query.trim()}"`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
