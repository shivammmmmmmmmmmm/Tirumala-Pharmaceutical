'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { reportsApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'

export default function AdminReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [sales, setSales] = useState<any>(null)
  const [areas, setAreas] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])

  const load = async () => {
    const [s, a, p] = await Promise.all([
      reportsApi.sales(),
      reportsApi.areaWise(),
      reportsApi.products(),
    ])
    setSales(s)
    setAreas(a)
    setTopProducts(p)
  }

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 15000, !!user && user.role === 'ADMIN')

  const download = async (type: string) => {
    const res = await reportsApi.exportCsv(type)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}-report.csv`
    a.click()
  }

  if (authLoading || !user) return null

  return (
    <div className="contents">
<main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <div className="flex gap-2">
            {['sales', 'users', 'products'].map(t => (
              <button key={t} onClick={() => download(t)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white">
                Export {t} CSV
              </button>
            ))}
          </div>
        </div>

        {sales?.summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold">{sales.summary.total_orders}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-bold">₹{Number(sales.summary.total_revenue).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-2xl font-bold text-amber-700">₹{Number(sales.summary.outstanding).toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Area-wise Performance</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th>Area</th><th>Orders</th><th>Revenue</th></tr></thead>
              <tbody>
                {areas.map((r, i) => (
                  <tr key={i} className="border-t"><td>{r.area}</td><td>{r.orders}</td><td>₹{Number(r.revenue).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Top Products</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>
                {topProducts.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t"><td>{r.name}</td><td>{r.units_sold}</td><td>₹{Number(r.revenue).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  )
}
