'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsApi } from '@/lib/api'
import type { AppNotification } from '@/lib/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const esRef = useRef<EventSource | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await notificationsApi.list()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      /* ignore when logged out */
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) return

    const url = `${BASE}/notifications/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        if (payload.event === 'notification' && payload.data) {
          setNotifications(prev => [payload.data, ...prev.filter(n => n.id !== payload.data.id)])
          setUnreadCount(c => c + 1)
        }
      } catch { /* ping */ }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [enabled, refresh])

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id)
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead }
}
