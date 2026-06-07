'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'
import { dashboardApi, uploadsApi } from '@/lib/api'
import { SkeletonCard, SkeletonStats } from '@/components/Loader'
import LocationPicker, { PickedLocation } from '@/components/LocationPicker'
import type { SPDashboard } from '@/lib/types'

const STATUS_PILL: Record<string, string> = {
  PENDING: 'badge-pending', APPROVED: 'badge-approved', DISPATCHED: 'badge-dispatched',
  DELIVERED: 'badge-delivered', COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
}

const QUICK = [
  { href: '/sp/place-order', label: 'Place Order',  icon: '🛒', color: 'from-blue-500 to-blue-600',    shadow: 'shadow-blue-500/20' },
  { href: '/sp/customers/new', label: 'New Customer', icon: '👤', color: 'from-emerald-500 to-teal-600',  shadow: 'shadow-emerald-500/20' },
  { href: '/sp/delivery',    label: 'Deliveries',   icon: '🚚', color: 'from-orange-500 to-amber-600',  shadow: 'shadow-orange-500/20' },
  { href: '/sp/commissions', label: 'Commissions',  icon: '💰', color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

export default function SPDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData]             = useState<SPDashboard | null>(null)
  const [loading, setLoading]       = useState(true)
  const [photoUrl, setPhotoUrl]     = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [showLocPicker, setShowLocPicker] = useState(false)
  const [savedLoc, setSavedLoc]     = useState<PickedLocation | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SALES_PERSON') {
      dashboardApi.get().then(setData).catch(console.error).finally(() => setLoading(false))
      // Load saved photo from user profile
      if ((user as any).photoUrl) setPhotoUrl(`${API_BASE}${(user as any).photoUrl}`)
    }
  }, [user])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5MB'); return }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await uploadsApi.upload({
          docType: 'photo',
          fileName: file.name,
          dataUrl: String(reader.result),
        })
        setPhotoUrl(`${API_BASE}${result.url}`)
      } catch (err) { console.error(err) }
      finally { setUploading(false) }
    }
    reader.readAsDataURL(file)
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null

  const initials = user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5 pb-2">
      {showLocPicker && (
        <LocationPicker
          value={savedLoc}
          onChange={loc => { setSavedLoc(loc); setShowLocPicker(false) }}
          onClose={() => setShowLocPicker(false)}
        />
      )}

      {/* Profile header */}
      <div className="flex items-center gap-4">
        {/* Avatar / photo */}
        <div className="relative shrink-0">
          <div
            onClick={() => photoRef.current?.click()}
            className="h-16 w-16 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center cursor-pointer shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-opacity"
            title="Tap to change photo"
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{initials}</span>
            )}
          </div>
          {/* Camera overlay */}
          <div
            onClick={() => photoRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full bg-white shadow-md cursor-pointer hover:bg-slate-50 transition-colors border border-slate-100"
          >
            {uploading ? (
              <svg className="h-3 w-3 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3"/><path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            ) : (
              <svg className="h-3 w-3 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            )}
          </div>
          <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Sales Dashboard</p>
          <h1 className="text-xl font-bold text-slate-900 truncate">{user.name}</h1>
          {user.spReferralCode && (
            <p className="text-xs text-emerald-700 font-mono font-semibold mt-0.5">Code: {user.spReferralCode}</p>
          )}
          {user.organizationName && <p className="text-xs text-slate-400 truncate">{user.organizationName}</p>}
        </div>

        {/* Location button */}
        <button onClick={() => setShowLocPicker(true)}
          className="shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
          {savedLoc ? (
            <>
              <span className="text-lg">📍</span>
              <span className="text-[10px] font-bold text-blue-600 leading-none">Located</span>
            </>
          ) : (
            <>
              <span className="text-lg group-hover:scale-110 transition-transform">🗺️</span>
              <span className="text-[10px] font-bold text-slate-500 leading-none">Set Location</span>
            </>
          )}
        </button>
      </div>

      {/* Saved location preview */}
      {savedLoc && (
        <button onClick={() => setShowLocPicker(true)}
          className="w-full flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl text-left hover:bg-blue-100 transition-colors">
          <span className="text-xl shrink-0">📍</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-800">Your Territory Location</p>
            <p className="text-xs text-blue-600 truncate">{savedLoc.address || `${savedLoc.latitude?.toFixed(4)}, ${savedLoc.longitude?.toFixed(4)}`}</p>
          </div>
          <span className="text-xs text-blue-400 shrink-0">Change →</span>
        </button>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonStats count={3} />
          <SkeletonCard rows={3} />
        </div>
      ) : data ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Sales',        value: `₹${Number(data.totalSales).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,        color: 'text-emerald-600' },
              { label: 'Earned Commission',  value: `₹${Number(data.earnedCommission).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,  color: 'text-blue-600' },
              { label: 'Pending Commission', value: `₹${Number(data.pendingCommission).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-amber-600' },
              { label: 'My Customers',       value: data.myCustomers,         color: 'text-slate-800' },
              { label: 'Total Orders',       value: data.myOrders,            color: 'text-slate-800' },
              { label: 'Pending Deliveries', value: data.pendingDeliveries,   color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="card-hover bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK.map(a => (
                <Link key={a.href} href={a.href}
                  className={`card-hover btn-press flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${a.color} text-white shadow-lg ${a.shadow}`}>
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-xs font-semibold text-center">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-800">Recent Orders</h2>
              <Link href="/sp/orders" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">View all →</Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-slate-400">No orders yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {data.recentOrders.map(o => (
                  <li key={o.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{o.orderNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{o.userName || 'Customer'}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[o.status] ?? ''}`}>
                      {o.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
