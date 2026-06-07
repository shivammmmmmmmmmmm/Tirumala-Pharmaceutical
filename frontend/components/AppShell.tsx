'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import AppNavbar from '@/components/AppNavbar'
import BottomNav from '@/components/BottomNav'
import Loader from '@/components/Loader'
import { TirumalaFooter } from '@/components/TirumalaBrand'
import { dashboardPathForRole } from '@/lib/nav-config'
import type { UserRole } from '@/lib/types'

export default function AppShell({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole: UserRole
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (user.role !== requiredRole) router.replace(dashboardPathForRole(user.role))
  }, [user, loading, requiredRole, router])

  if (loading || !user || user.role !== requiredRole) {
    return <Loader />
  }

  const isAdmin = user.role === 'ADMIN'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f4ff' }}>
      <AppNavbar user={user} />
      <main
        className={`flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-6 ${
          !isAdmin ? 'lg:pb-6 pb-24' : ''
        } page-enter`}
      >
        {children}
      </main>
      {/* Bottom nav only for mobile on non-admin roles */}
      {!isAdmin && <BottomNav user={user} />}
      <TirumalaFooter />
    </div>
  )
}
