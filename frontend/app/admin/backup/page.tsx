'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { accountingApi } from '@/lib/api'

export default function AdminBackupPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  const loadHistory = async () => {
    setLoading(true)
    try {
      setHistory(await accountingApi.backupHistory())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user?.role === 'ADMIN') loadHistory() }, [user?.role])

  const downloadBackup = async () => {
    setDownloading(true)
    try {
      const backup = await accountingApi.backup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup.fileName || `db-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      await loadHistory()
    } catch (e: any) {
      alert(e.message || 'Backup failed')
    } finally {
      setDownloading(false)
    }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup</h1>
          <p className="text-sm text-gray-500 mt-1">Download database backup files and review backup history.</p>
        </div>
        <button
          onClick={downloadBackup}
          disabled={downloading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {downloading ? 'Preparing...' : 'Download Backup'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Backup History</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['File', 'Taken By', 'Date', 'Records'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No backups taken yet</td></tr>
              ) : history.map(item => {
                const counts = item.tableCounts || {}
                const total = Object.values(counts).reduce((sum: number, v: any) => sum + Number(v || 0), 0)
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.fileName}</td>
                    <td className="px-4 py-3 text-gray-600">{item.createdByName || 'Admin'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(item.createdAt).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-700">{Number(total).toLocaleString('en-IN')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
