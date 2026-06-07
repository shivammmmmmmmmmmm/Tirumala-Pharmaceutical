'use client'

/**
 * PaymentDetails — shows bank or UPI info after a payment method is selected.
 * Used in both SP place-order and user checkout.
 */
export default function PaymentDetails({ method }: { method: string }) {
  if (method === 'BANK_TRANSFER') {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">Bank Transfer Details</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-600 font-medium">Bank</span>
          <span className="text-xs font-bold text-emerald-900">Axis Bank Ltd.</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-600 font-medium">Account No.</span>
          <span className="text-xs font-bold text-emerald-900 font-mono tracking-wider select-all">922020015964543</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-600 font-medium">IFSC Code</span>
          <span className="text-xs font-bold text-emerald-900 font-mono tracking-wider select-all">UTIB0000318</span>
        </div>
        <p className="text-[10px] text-emerald-600 mt-1 border-t border-emerald-200 pt-1.5">
          Use your Order Number as the payment reference. Send screenshot after transfer.
        </p>
      </div>
    )
  }

  if (method === 'UPI') {
    return (
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-3">Scan & Pay via UPI</p>
        <div className="flex flex-col items-center gap-3">
          {/* QR code image */}
          <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-sm bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Payment QR.jpeg"
              alt="UPI Payment QR Code"
              className="h-44 w-44 object-contain"
            />
          </div>
          {/* UPI ID */}
          <div className="w-full flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-blue-200 shadow-sm">
            <span className="text-xs font-semibold text-blue-600">UPI ID</span>
            <span className="text-xs font-bold text-blue-900 font-mono select-all tracking-wide">
              girish.kolekar-1@okicici
            </span>
          </div>
        </div>
        <p className="text-[10px] text-blue-600 mt-2 text-center">
          Scan the QR or pay to the UPI ID above. Use Order Number as reference.
        </p>
      </div>
    )
  }

  return null
}
