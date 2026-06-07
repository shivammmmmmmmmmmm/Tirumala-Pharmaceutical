'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { NAV_BY_ROLE } from '@/lib/nav-config'
import { TirumalaBrand } from '@/components/TirumalaBrand'
import NotificationCenter from '@/components/NotificationCenter'
import type { User } from '@/lib/types'

const ROLE_CONFIG: Record<string, { badge: string; label: string; dot: string }> = {
  ADMIN:        { badge: 'bg-violet-100 text-violet-700', label: 'Admin',   dot: 'bg-violet-500' },
  SALES_PERSON: { badge: 'bg-emerald-100 text-emerald-700', label: 'Sales', dot: 'bg-emerald-500' },
  USER:         { badge: 'bg-sky-100 text-sky-700', label: 'Retailer',      dot: 'bg-sky-500' },
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
}
function isGroupActive(pathname: string, group: { href?: string; items?: { href: string }[] }) {
  if (group.href && isActive(pathname, group.href)) return true
  return group.items?.some(i => isActive(pathname, i.href)) ?? false
}

export default function AppNavbar({ user }: { user: User }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const menu      = NAV_BY_ROLE[user.role]
  const [open, setOpen]         = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef    = useRef<HTMLDivElement>(null)
  const role      = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.USER
  const isAdmin   = user.role === 'ADMIN'

  useEffect(() => { setOpen(null); setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const logout = () => { authClient.logout(); router.push('/login') }

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 glass border-b border-white/60 shadow-sm"
      style={{ height: 'var(--app-nav-height)' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-full flex items-center justify-between gap-3">

        <TirumalaBrand size="sm" href={menu[0]?.href || '/'} className="shrink-0" />

        {/* Desktop nav — admin and non-admin on large screens */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
          {menu.map(group => {
            if (group.href && !group.items) {
              const active = isActive(pathname, group.href)
              return (
                <Link key={group.label} href={group.href}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}>
                  {group.label}
                </Link>
              )
            }
            const active = isGroupActive(pathname, group)
            const isOpen = open === group.label
            return (
              <div key={group.label} className="relative">
                <button type="button"
                  onClick={() => setOpen(isOpen ? null : group.label)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100/80'
                  }`}>
                  {group.label}
                  <svg className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isOpen && group.items && (
                  <div className="absolute left-0 top-full mt-1.5 min-w-[180px] rounded-xl border border-slate-100 bg-white/95 backdrop-blur py-1.5 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-150">
                    {group.items.map(item => (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          isActive(pathname, item.href)
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <NotificationCenter user={user} />
          {/* User badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className={`h-2 w-2 rounded-full ${role.dot}`} />
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-slate-800 truncate max-w-[100px]">{user.name}</p>
              <p className={`text-[10px] font-medium ${role.badge.split(' ')[1]}`}>{role.label}</p>
            </div>
          </div>

          <button type="button" onClick={logout}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all duration-150 btn-press">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>

          {/* Mobile hamburger — admin only (non-admin uses BottomNav) */}
          {isAdmin && (
            <button type="button" onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition btn-press"
              aria-label="Toggle menu">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown — admin only */}
      {isAdmin && mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white/95 backdrop-blur max-h-[70vh] overflow-y-auto shadow-xl">
          <div className="px-3 py-3 space-y-1">
            {menu.map(group => {
              if (group.href && !group.items) {
                return (
                  <Link key={group.label} href={group.href}
                    className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive(pathname, group.href) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                    {group.label}
                  </Link>
                )
              }
              return (
                <div key={group.label} className="pt-1">
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
                  {group.items?.map(item => (
                    <Link key={item.href} href={item.href}
                      className={`block px-4 py-2 rounded-xl text-sm transition-colors ${
                        isActive(pathname, item.href) ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                      }`}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )
            })}
            <button type="button" onClick={logout}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl">
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
