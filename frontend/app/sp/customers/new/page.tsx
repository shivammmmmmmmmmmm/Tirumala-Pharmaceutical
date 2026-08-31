'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { usersApi } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import type { CustomerType } from '@/lib/types'

interface NewCustomerForm {
  email: string
  password: string
  partyName: string
  name: string
  phone: string
  organizationName: string
  customerType: CustomerType
  billingAddress: string
  shippingAddress: string
  latitude: string
  longitude: string
  drugLicenceNumber: string
  drugLicenceExpiry: string
  gstNumber: string
  foodLicenceNumber: string
}

export default function SPNewCustomerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<NewCustomerForm>({
    email: '', password: '', partyName: '', name: '', phone: '', organizationName: '',
    customerType: 'PHARMACY',
    billingAddress: '', shippingAddress: '',
    latitude: '', longitude: '',
    drugLicenceNumber: '', drugLicenceExpiry: '', gstNumber: '', foodLicenceNumber: '',
  })
  const [aadhaarDataUrl, setAadhaar] = useState('')
  const [passportPhotoDataUrl, setPassportPhoto] = useState('')
  const [drugLicenceDataUrl, setDrugLicenceDataUrl] = useState('')
  const [gstProofDataUrl, setGstProofDataUrl] = useState('')
  const [foodLicenceDataUrl, setFoodLicenceDataUrl] = useState('')
  const [salesPersonLivePhotoDataUrl, setSalesPersonLivePhotoDataUrl] = useState('')
  const [sameAsBilling, setSameAsBilling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SALES_PERSON')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (sameAsBilling) setForm(f => ({ ...f, shippingAddress: f.billingAddress }))
  }, [sameAsBilling, form.billingAddress])

  const set = (k: keyof NewCustomerForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('latitude', String(pos.coords.latitude))
        set('longitude', String(pos.coords.longitude))
      },
      () => alert('Could not get location. Enter coordinates manually or enable GPS.')
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name.trim() || !form.phone.trim() || !form.organizationName.trim()) {
      setError('Customer name, phone, and organization name are required')
      return
    }
    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required')
      return
    }
    if (!form.billingAddress.trim() || !form.shippingAddress.trim()) {
      setError('Billing and shipping addresses are required')
      return
    }
    if (!form.drugLicenceNumber.trim() || !form.drugLicenceExpiry.trim() || !form.gstNumber.trim() || !form.foodLicenceNumber.trim()) {
      setError('All important details are required')
      return
    }
    if (!aadhaarDataUrl) {
      setError('Aadhaar/PAN document is required')
      return
    }
    if (!passportPhotoDataUrl) {
      setError('Passport-size photo is required')
      return
    }
    if (!drugLicenceDataUrl) {
      setError('Drug licence copy is required')
      return
    }
    if (!gstProofDataUrl) {
      setError('GST proof document is required')
      return
    }
    if (!foodLicenceDataUrl) {
      setError('Food licence copy is required')
      return
    }
    if (!salesPersonLivePhotoDataUrl) {
      setError('Live salesperson photo is required')
      return
    }

    setSaving(true)
    try {
      await usersApi.create({
        ...form,
        newRole: 'USER',
        aadhaarDataUrl,
        photoDataUrl: passportPhotoDataUrl,
        drugLicenceDataUrl,
        gstProofDataUrl,
        foodLicenceDataUrl,
        salesPersonLivePhotoDataUrl,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      })
      setSuccess('Registration submitted for admin approval. Customer will appear on your dashboard after verification.')
      setTimeout(() => router.push('/sp/customers'), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user || user.role !== 'SALES_PERSON') return null
  const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/sp/customers')} className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Register Pharmacy / Customer</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your referral code: <span className="font-mono font-bold text-emerald-700">{user.spReferralCode || '—'}</span>
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
        Submissions go to <strong>Admin → Approvals</strong>. After admin verifies documents, sets credit limit &amp; commission, the customer appears on your dashboard.
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Basic details</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="partyName" className="block text-xs font-semibold text-slate-600 mb-1">Party name *</label>
                <input id="partyName" name="partyName" className={inp} value={form.partyName} onChange={e => set('partyName', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-slate-600 mb-1">Customer name *</label>
                <input id="name" name="name" className={inp} value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-slate-600 mb-1">Phone *</label>
                <input id="phone" name="phone" type="tel" className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} required />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="organizationName" className="block text-xs font-semibold text-slate-600 mb-1">Shop / organization name *</label>
                <input id="organizationName" name="organizationName" className={inp} value={form.organizationName} onChange={e => set('organizationName', e.target.value)} required />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                <input id="email" name="email" type="email" className={inp} value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
                <input id="password" name="password" type="password" className={inp} value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} />
              </div>
            </div>
          </section>
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Important details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="drugLicenceNumber" className="block text-xs font-semibold text-slate-600 mb-1">Drug licence number *</label>
                <input id="drugLicenceNumber" name="drugLicenceNumber" className={inp} value={form.drugLicenceNumber} onChange={e => set('drugLicenceNumber', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="drugLicenceExpiry" className="block text-xs font-semibold text-slate-600 mb-1">Drug licence expiry date *</label>
                <input id="drugLicenceExpiry" name="drugLicenceExpiry" type="date" className={inp} value={form.drugLicenceExpiry} onChange={e => set('drugLicenceExpiry', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="gstNumber" className="block text-xs font-semibold text-slate-600 mb-1">GST number *</label>
                <input id="gstNumber" name="gstNumber" className={inp} value={form.gstNumber} onChange={e => set('gstNumber', e.target.value)} required />
              </div>
              <div>
                <label htmlFor="foodLicenceNumber" className="block text-xs font-semibold text-slate-600 mb-1">Food licence number *</label>
                <input id="foodLicenceNumber" name="foodLicenceNumber" className={inp} value={form.foodLicenceNumber} onChange={e => set('foodLicenceNumber', e.target.value)} required />
              </div>
            </div>
          </section>
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Addresses</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Billing address *</label>
                <textarea className={inp} rows={2} value={form.billingAddress} onChange={e => set('billingAddress', e.target.value)} required placeholder="Full billing address with pincode" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={sameAsBilling} onChange={e => setSameAsBilling(e.target.checked)} />
                Shipping address same as billing
              </label>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Shipping address *</label>
                <textarea className={inp} rows={2} value={form.shippingAddress} onChange={e => set('shippingAddress', e.target.value)} required disabled={sameAsBilling} placeholder="Delivery / shipping address" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Live location</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input className={inp} value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="Latitude" />
              <input className={inp} value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="Longitude" />
              <button type="button" onClick={detectLocation} className="px-4 py-2.5 border border-emerald-300 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-50">
                Use current location
              </button>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Documents</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FileUpload label="Aadhaar card / PAN *" onFile={(d) => setAadhaar(d)} accept="image/*,.pdf" capture="environment" showSourceOptions />
              <FileUpload label="Passport-size photo *" onFile={(d) => setPassportPhoto(d)} accept="image/*" capture="user" showSourceOptions />
              <FileUpload label="Drug licence copy *" onFile={(d) => setDrugLicenceDataUrl(d)} accept="image/*,.pdf" capture="environment" showSourceOptions />
              <FileUpload label="GST number proof *" onFile={(d) => setGstProofDataUrl(d)} accept="image/*,.pdf" capture="environment" showSourceOptions />
              <FileUpload label="Food licence copy *" onFile={(d) => setFoodLicenceDataUrl(d)} accept="image/*,.pdf" capture="environment" showSourceOptions />
              <FileUpload label="Sales person live photo *" onFile={(d) => setSalesPersonLivePhotoDataUrl(d)} accept="image/*" capture="user" showSourceOptions />
            </div>
          </section>

          <div className="flex justify-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl text-sm disabled:opacity-60">
              {saving ? 'Submitting…' : 'Submit for approval'}
            </button>
            <button type="button" onClick={() => router.push('/sp/customers')} className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
