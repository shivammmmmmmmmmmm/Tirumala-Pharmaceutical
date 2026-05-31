'use client'

import { useEffect, useState } from 'react'
import { authClient } from './auth-client'
import { User } from './types'

let cachedUser: User | null = null
let cachedLoaded = false
let inFlight: Promise<User | null> | null = null

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedLoaded ? cachedUser : null)
  const [loading, setLoading] = useState(!cachedLoaded)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedLoaded) return

    const fetchUser = async () => {
      try {
        if (!authClient.isAuthenticated()) {
          cachedUser = null
          cachedLoaded = true
          return
        }

        // Deduplicate concurrent /auth/me calls across page navigations.
        if (!inFlight) {
          inFlight = authClient
            .getCurrentUser()
            .then(u => {
              cachedUser = u
              cachedLoaded = true
              return u
            })
            .catch(err => {
              cachedUser = null
              cachedLoaded = true
              throw err
            })
            .finally(() => {
              inFlight = null
            })
        }

        const u = await inFlight
        setUser(u)
      } catch (err) {
        setError((err as any).message || 'Failed to fetch user')
        authClient.logout()
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
  }
}

