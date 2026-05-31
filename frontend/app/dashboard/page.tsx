'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'

/** Legacy route — redirects to role dashboards */
export default function LegacyDashboardRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role === 'ADMIN') router.replace('/admin/dashboard')
    else if (user.role === 'SALES_PERSON') router.replace('/sp/dashboard')
    else router.replace('/user/dashboard')
  }, [user, loading, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
    </main>
  )
}
