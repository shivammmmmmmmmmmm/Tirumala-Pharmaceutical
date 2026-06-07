'use client'

/** @deprecated Use AppShell layout — kept for gradual migration */
import AppNavbar from './AppNavbar'
import type { User } from '@/lib/types'

export default function Navbar({ user }: { user: User; links?: unknown }) {
  return <AppNavbar user={user} />
}
