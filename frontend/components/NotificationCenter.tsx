'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/hooks/use-notifications'
import { notificationsApi } from '@/lib/api'
import ReceiptConfirmDialog from '@/components/ReceiptConfirmDialog'
import type { User } from '@/lib/types'

export default function NotificationCenter({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null)
  const [confirmOrderSpPhone, setConfirmOrderSpPhone] = useState<string | null>(null)
  const [confirmOrderSpName, setConfirmOrderSpName] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()
  const { notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications(true)

  // Get the correct redirect URL based on notification type and user role
  const getRedirectUrl = (n: typeof notifications[0]): string | null => {
    const actionType = n.actionType
    const role = user.role

    // USER specific
    if (role === 'USER') {
      if (actionType === 'CONFIRM_RECEIPT' || actionType === 'DELIVERY_CONFIRM_REQUEST') {
        return '/user/orders'
      }
      if (n.type === 'TRACKING_UPDATED') {
        return '/user/orders'
      }
      return '/user/orders'
    }

    // SALES_PERSON specific
    if (role === 'SALES_PERSON') {
      if (actionType === 'SUBMIT_TRACKING' || actionType === 'START_DELIVERY' || actionType === 'REQUEST_DISPATCH') {
        return '/sp/delivery'
      }
      if (actionType === 'CONFIRM_RECEIPT' || n.type === 'RECEIPT_CONFIRMED') {
        return '/sp/delivery'
      }
      if (n.type === 'PAYMENT_VERIFIED' || n.type === 'DISPATCH_REQUEST') {
        return '/sp/delivery'
      }
      if (n.type === 'COMMISSION_RELEASED') {
        return '/sp/commissions'
      }
      return '/sp/orders'
    }

    // ADMIN specific
    if (role === 'ADMIN') {
      if (actionType === 'VERIFY_PAYMENT' || actionType === 'REVIEW_ORDER' || n.type === 'NEW_ORDER') {
        return '/admin/orders'
      }
      if (actionType === 'RELEASE_COMMISSION' || actionType === 'SET_COMMISSION' || n.type === 'COMMISSION_PENDING') {
        return '/admin/commissions'
      }
      if (n.type === 'TRACKING_SUBMITTED' || n.type === 'DELIVERY_CONFIRMED') {
        return '/admin/commissions'
      }
      if (n.type === 'RECEIPT_DISPUTED') {
        return '/admin/orders'
      }
      return '/admin/orders'
    }

    return null
  }

  const handleClick = async (n: typeof notifications[0]) => {
    if (!n.isRead) await markRead(n.id)
    
    // For USER: open receipt confirmation dialog
    if (n.actionType === 'CONFIRM_RECEIPT' && n.orderId && user.role === 'USER') {
      // Extract SP info from metadata if available
      const meta = n.metadata as Record<string, any> | null
      setConfirmOrderSpName(meta?.spName as string || null)
      setConfirmOrderSpPhone(meta?.spPhone as string || null)
      setConfirmOrderId(n.orderId)
      setOpen(false)
      return
    }

    // Navigate to the relevant page
    const url = getRedirectUrl(n)
    if (url) {
      router.push(url)
      setOpen(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleting(id)
    try {
      await notificationsApi.delete(id)
      refresh()
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition btn-press"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 text-sm">Notifications</p>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{unreadCount} new</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllRead} className="text-xs text-blue-600 font-medium hover:text-blue-700 transition">
                      Mark all read
                    </button>
                  )}
                  <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center px-4">
                  <span className="text-4xl mb-3">🔔</span>
                  <p className="text-sm text-slate-400 font-medium">No notifications</p>
                  <p className="text-xs text-slate-300 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {notifications.map(n => (
                    <li key={n.id}>
                      <div className={`group relative ${!n.isRead ? 'bg-blue-50/40' : ''} hover:bg-blue-50/60 transition-colors`}>
                        <button
                          type="button"
                          onClick={() => handleClick(n)}
                          className="w-full text-left px-4 py-3.5 pr-12 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                  {n.title}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                {n.requiresAction && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    Action required
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={e => handleDelete(e, n.id)}
                          disabled={deleting === n.id}
                          className="absolute right-2 top-3 h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                          title="Delete notification"
                        >
                          {deleting === n.id ? (
                            <span className="h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 p-2">
                <p className="text-center text-[10px] text-slate-400">Click a notification to go to the relevant page</p>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmOrderId && (
        <ReceiptConfirmDialog
          orderId={confirmOrderId}
          onClose={() => setConfirmOrderId(null)}
          onDone={() => { setConfirmOrderId(null); refresh() }}
          spPhone={confirmOrderSpPhone}
          spName={confirmOrderSpName}
        />
      )}
    </>
  )
}