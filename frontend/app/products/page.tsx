'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'

/** Legacy route — sends users to the correct product browser */
export default function LegacyProductsRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.role === 'ADMIN') router.replace('/admin/products')
    else if (user.role === 'SALES_PERSON') router.replace('/sp/place-order')
    else router.replace('/user/products')
  }, [user, loading, router])

  return null
}
