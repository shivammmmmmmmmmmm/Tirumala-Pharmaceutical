'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { accountingApi } from '@/lib/api'
import { usePolling } from '@/hooks/use-polling'
import { useState } from 'react'

export default function AccountingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => setData(await accountingApi.summary({ paymentMethod: paymentMethod || undefined, status: status || undefined, from: from || undefined, to: to || undefined }))

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  usePolling(load, 15000, !!user && user.role === 'ADMIN')

  if (authLoading || !user) return null

  const cards = data
    ? [
        { label: 'Total Revenue', value: data.totalRevenue, color: 'text-blue-700' },
        { label: 'Collected', value: data.totalCollected, color: 'text-green-700' },
        { label: 'Accounts Receivable', value: data.accountsReceivable, color: 'text-amber-700' },
        { label: 'Credit Exposure', value: data.creditExposure, color: 'text-red-700' },
        { label: 'Commissions Payable', value: data.commissionsPayable, color: 'text-purple-700' },
        { label: 'GST Collected (12%)', value: data.gstCollected, color: 'text-gray-700' },
      ]
    : []

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [paymentMethod, status, from, to, user?.role])

  return (
    <main className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Accounting Dashboard</h1>
        <div className="mb-6 grid sm:grid-cols-4 gap-3">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="px-3 py-2 border rounded-lg bg-white text-sm">
            <option value="">All Payment Modes</option>
            <option value="CREDIT">Credit</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border rounded-lg bg-white text-sm">
            <option value="">All Order Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="DELIVERED">Delivered</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <div key={c.label} className="bg-white border rounded-xl p-5">
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>₹{Number(c.value).toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      </main>
  )
}
