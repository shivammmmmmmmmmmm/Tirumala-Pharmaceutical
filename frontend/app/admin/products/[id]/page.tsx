'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { productsApi } from '@/lib/api'
import Navbar from '@/components/Navbar'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/sales-persons', label: 'Sales Persons' },
  { href: '/admin/commissions', label: 'Commissions' },
]

const CATEGORIES = ['Analgesics','Antibiotics','Antidiabetics','Cardiovascular','Gastrointestinal',
  'Antihistamines','Respiratory','Vitamins','Dermatology','Neurology','Oncology','Other']
const DOSAGE_FORMS = ['Tablet','Capsule','Syrup','Injection','Cream','Ointment','Drops','Inhaler','Patch','Powder','Other']

export default function ProductFormPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const [form, setForm] = useState({
    name: '', companyName: '', category: '', description: '', ingredients: '',
    strength: '', dosageForm: 'Tablet', mrp: '', sellingPrice: '', discountPct: '',
    sku: '', manufacturer: '', quantity: '', reorderLevel: '', isActive: true,
  })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!isNew && user?.role === 'ADMIN') {
      productsApi.get(id).then(p => {
        setForm({
          name: p.name, companyName: p.companyName||'', category: p.category||'',
          description: p.description||'', ingredients: p.ingredients||'',
          strength: p.strength||'', dosageForm: p.dosageForm||'Tablet',
          mrp: String(p.mrp), sellingPrice: String(p.sellingPrice),
          discountPct: String(p.discountPct), sku: p.sku,
          manufacturer: p.manufacturer||'', quantity: String(p.quantity),
          reorderLevel: String(p.reorderLevel), isActive: p.isActive,
        })
      }).catch(() => setError('Product not found')).finally(() => setLoading(false))
    }
  }, [id, isNew, user])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      const payload = {
        name: form.name, companyName: form.companyName, category: form.category,
        description: form.description, ingredients: form.ingredients,
        strength: form.strength, dosageForm: form.dosageForm,
        mrp: parseFloat(form.mrp)||0, sellingPrice: parseFloat(form.sellingPrice)||0,
        discountPct: parseFloat(form.discountPct)||0, sku: form.sku,
        manufacturer: form.manufacturer, quantity: parseInt(form.quantity)||0,
        reorderLevel: parseInt(form.reorderLevel)||0, isActive: form.isActive,
      }
      if (isNew) {
        await productsApi.create(payload)
        setSuccess('Product created!')
        setTimeout(() => router.push('/admin/products'), 1000)
      } else {
        await productsApi.update(id, payload)
        setSuccess('Product updated!')
      }
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} links={ADMIN_LINKS} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/admin/products')} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'Add New Product' : 'Edit Product'}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

            {/* Basic Info */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Product Name" required><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required /></Field>
                <Field label="SKU / Product Code" required><input className={inp} value={form.sku} onChange={e => set('sku', e.target.value)} required /></Field>
                <Field label="Company Name"><input className={inp} value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="e.g. Sun Pharma" /></Field>
                <Field label="Manufacturer"><input className={inp} value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} /></Field>
                <Field label="Category">
                  <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Dosage Form">
                  <select className={inp} value={form.dosageForm} onChange={e => set('dosageForm', e.target.value)}>
                    {DOSAGE_FORMS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Strength"><input className={inp} value={form.strength} onChange={e => set('strength', e.target.value)} placeholder="e.g. 500mg, 10ml" /></Field>
                <Field label="Status">
                  <select className={inp} value={form.isActive ? 'active' : 'inactive'} onChange={e => set('isActive', e.target.value === 'active')}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Description">
                  <textarea className={inp} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Ingredients / Composition">
                  <textarea className={inp} rows={2} value={form.ingredients} onChange={e => set('ingredients', e.target.value)} placeholder="Active ingredients, salts, composition" />
                </Field>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="MRP (₹)" required>
                  <input className={inp} type="number" step="0.01" min="0" value={form.mrp} onChange={e => set('mrp', e.target.value)} required />
                </Field>
                <Field label="Selling Price (₹)" required>
                  <input className={inp} type="number" step="0.01" min="0" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} required />
                </Field>
                <Field label="Discount %">
                  <input className={inp} type="number" step="0.01" min="0" max="100" value={form.discountPct} onChange={e => set('discountPct', e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Inventory</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Stock Quantity">
                  <input className={inp} type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
                </Field>
                <Field label="Reorder Level">
                  <input className={inp} type="number" min="0" value={form.reorderLevel} onChange={e => set('reorderLevel', e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition text-sm">
                {saving ? 'Saving…' : isNew ? 'Create Product' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => router.push('/admin/products')}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
