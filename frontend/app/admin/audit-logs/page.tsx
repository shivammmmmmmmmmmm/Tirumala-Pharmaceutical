'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { auditApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'

export default function AdminAuditLogsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])

  const load = useCallback(async () => {
    const res = await auditApi.list(1)
    setLogs(res.data)
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 12000, !!user && user.role === 'ADMIN')

  if (authLoading || !user) return null

  return (
    <div className="contents">
<main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Action</th>
                <th className="text-left p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-3">{l.userName || '—'}</td>
                  <td className="p-3 font-medium">{l.action}</td>
                  <td className="p-3 text-gray-600">{l.details || `${l.entityType || ''} ${l.entityId || ''}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="p-6 text-gray-500 text-center">No audit entries yet.</p>}
        </div>
      </main>
    </div>
  )
}
