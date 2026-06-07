'use client'

import { useState } from 'react'
import { ordersApi } from '@/lib/api'
import { Spinner } from '@/components/Loader'

export default function ReceiptConfirmDialog({
  orderId,
  onClose,
  onDone,
  spPhone,
  spName,
}: {
  orderId: string
  onClose: () => void
  onDone: () => void
  spPhone?: string | null
  spName?: string | null
}) {
  const [remark, setRemark] = useState('')
  const [step, setStep] = useState<'choose' | 'remark'>('choose')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (received: boolean) => {
    if (!received && remark.trim().length < 3) {
      setError('Please enter a remark (min 3 characters)')
      return
    }
    setSaving(true)
    setError('')
    try {
      // Use the new unified confirm-receipt endpoint
      await ordersApi.confirmReceipt(orderId, received, received ? undefined : remark)
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900">Have you received your order?</h2>
        <p className="text-sm text-slate-500 mt-1">Please confirm if you received the delivery.</p>

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

        {step === 'choose' ? (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              type="button"
              disabled={saving}
              onClick={() => submit(true)}
              className="py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Spinner className="h-4 w-4 text-white" /> : '✓'}
              Yes, Received
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setStep('remark')}
              className="py-4 rounded-xl border-2 border-red-200 text-red-700 font-bold text-sm hover:bg-red-50"
            >
              Not Received
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Show SP contact info when customer says No */}
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Contact Your Sales Person</p>
              {spName && <p className="text-sm font-semibold text-slate-800 mt-1">{spName}</p>}
              {spPhone && (
                <a href={`tel:${spPhone}`} className="text-sm text-blue-600 font-semibold mt-1 inline-block">
                  📞 {spPhone}
                </a>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">Please describe the issue:</p>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={3}
              placeholder="Describe the issue (required)…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep('choose'); setError('') }} className="flex-1 py-2.5 border rounded-xl text-sm">Back</button>
              <button
                type="button"
                disabled={saving || remark.trim().length < 3}
                onClick={() => submit(false)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
    </div>
  )
}