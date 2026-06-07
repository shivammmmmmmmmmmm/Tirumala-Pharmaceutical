'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { inventoryApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [low, setLow] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any>(null)
  const [productId, setProductId] = useState('')
  const [delta, setDelta] = useState('')

  const load = async () => {
    setLow(await inventoryApi.lowStock())
    setAlerts(await inventoryApi.alerts())
  }

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 12000, !!user && user.role === 'ADMIN')

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault()
    await inventoryApi.adjust(productId, parseInt(delta), 'Manual')
    setDelta('')
    load()
  }

  if (authLoading || !user) return null

  return (
    <div className="contents">
<main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Inventory & Stock Alerts</h1>
        {alerts && (
          <p className="text-sm text-amber-700 mb-6">
            {alerts.lowStockCount} low-stock items · {alerts.expiringSoonCount} expiring within 90 days
          </p>
        )}
        <form onSubmit={adjust} className="bg-white border rounded-xl p-4 mb-6 flex flex-wrap gap-2">
          <input value={productId} onChange={e => setProductId(e.target.value)} placeholder="Product ID" className="border rounded px-3 py-2 text-sm flex-1 min-w-[120px]" />
          <input value={delta} onChange={e => setDelta(e.target.value)} placeholder="Delta (+/-)" type="number" className="border rounded px-3 py-2 text-sm w-28" />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Adjust Stock</button>
        </form>
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="text-left p-3">Product</th><th>SKU</th><th>Qty</th><th>Reorder</th></tr></thead>
            <tbody>
              {low.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 text-gray-500">{p.sku}</td>
                  <td className="p-3 text-red-600 font-medium">{p.quantity}</td>
                  <td className="p-3">{p.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
