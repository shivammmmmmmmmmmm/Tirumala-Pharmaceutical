'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { productsApi, uploadsApi, companiesApi, compositionsApi, gstRatesApi, categoriesApi } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import SearchableSelect from '@/components/SearchableSelect'
import { getImageUrl } from '@/lib/image-utils'
import type { Company, Composition, GstRate } from '@/lib/types'

const DOSAGE_FORMS = ['Tablet','Capsule','Syrup','Respule','Patches','Ampoules','Vials','IV','Injection','Cream','Ointment','Drops','Inhaler','Patch','Powder','Granules','Suspension','Gel','Lotion','Spray','Other']
const SCHEDULES = ['Schedule H', 'Schedule H1', 'Schedule X', 'OTC', 'Schedule G', 'None']

function Field({ label, required, span2, children }: { label: string; required?: boolean; span2?: boolean; children: React.ReactNode }) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  )
}

export default function ProductFormPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const [form, setForm] = useState({
    name: '', companyName: '', companyId: '', compositionId: '', gstId: '',
    category: '', description: '', ingredients: '',
    strength: '', dosageForm: 'Tablet', mrp: '', sellingPrice: '', discountPct: '',
    gstPct: '12', sku: '', manufacturer: '', quantity: '', reorderLevel: '',
    isActive: true, imageUrl: '',
    hsnCode: '', packing: '', unitsPerBox: '1', retailUnits: '1',
    minQuantity: '1', storageLocation: '', schedule: 'None',
    scheme: '', barcode: '', batchNumber: '', expiryDate: '',
  })

  // Masters
  const [companies, setCompanies]     = useState<Company[]>([])
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [gstRates, setGstRates]       = useState<GstRate[]>([])
  const [categories, setCategories]   = useState<{ id: string; name: string }[]>([])

  const [imageDataUrl, setImageDataUrl] = useState('')
  const [loading, setLoading]   = useState(!isNew)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
  }, [user, authLoading, router])

  // Load masters in parallel
  useEffect(() => {
    if (!user?.role) return
    Promise.all([
      companiesApi.list({ activeOnly: true }),
      compositionsApi.list({ activeOnly: true }),
      gstRatesApi.list(true),
      categoriesApi.list(),
    ]).then(([c, comp, gst, cat]) => {
      setCompanies(c)
      setCompositions(comp)
      setGstRates(gst)
      setCategories(cat)
    }).catch(console.error)
  }, [user])

  useEffect(() => {
    if (!isNew && user?.role === 'ADMIN') {
      productsApi.get(id).then(p => {
        setForm({
          name: p.name, companyName: p.companyName || '', companyId: p.companyId || '',
          compositionId: p.compositionId || '', gstId: p.gstId || '',
          category: p.category || '', description: p.description || '',
          ingredients: p.ingredients || '', strength: p.strength || '',
          dosageForm: p.dosageForm || 'Tablet',
          mrp: String(p.mrp), sellingPrice: String(p.sellingPrice),
          discountPct: String(p.discountPct), gstPct: String(p.gstPct || 12), sku: p.sku,
          manufacturer: p.manufacturer || '', quantity: String(p.quantity),
          reorderLevel: String(p.reorderLevel), isActive: p.isActive, imageUrl: p.imageUrl || '',
          hsnCode: p.hsnCode || '', packing: p.packing || '',
          unitsPerBox: String(p.unitsPerBox || 1), retailUnits: String(p.retailUnits || 1),
          minQuantity: String(p.minQuantity || 1), storageLocation: p.storageLocation || '',
          schedule: p.schedule || 'None', scheme: p.scheme || '',
          barcode: p.barcode || '', batchNumber: p.batchNumber || '',
          expiryDate: p.expiryDate || '',
        })
      }).catch(() => setError('Product not found')).finally(() => setLoading(false))
    }
  }, [id, isNew, user])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // When company selected from master, also set companyName
  const handleCompanyChange = (cId: string) => {
    const c = companies.find(co => co.id === cId)
    set('companyId', cId)
    if (c) set('companyName', c.name)
  }

  // When composition selected, also fill ingredients text
  const handleCompositionChange = (cId: string) => {
    const c = compositions.find(co => co.id === cId)
    set('compositionId', cId)
    if (c) set('ingredients', c.name)
  }

  // When GST selected, fill gstPct
  const handleGstChange = (gId: string) => {
    const g = gstRates.find(r => r.id === gId)
    set('gstId', gId)
    if (g) set('gstPct', String(g.percentage))
  }

  // Add new composition on-the-fly
  const handleAddComposition = async (name: string) => {
    const created = await compositionsApi.create({ name })
    setCompositions(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    set('compositionId', created.id)
    set('ingredients', created.name)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      let imageUrl = form.imageUrl
      if (imageDataUrl) {
        const up = await uploadsApi.upload({ docType: 'document', fileName: 'product.jpg', dataUrl: imageDataUrl })
        imageUrl = up.url
      }
      const payload = {
        name: form.name, companyName: form.companyName, companyId: form.companyId || null,
        compositionId: form.compositionId || null, gstId: form.gstId || null,
        category: form.category, description: form.description, ingredients: form.ingredients,
        strength: form.strength, dosageForm: form.dosageForm,
        mrp: parseFloat(form.mrp) || 0, sellingPrice: parseFloat(form.sellingPrice) || 0,
        discountPct: parseFloat(form.discountPct) || 0, gstPct: parseFloat(form.gstPct) || 12,
        sku: form.sku, manufacturer: form.manufacturer,
        quantity: parseInt(form.quantity) || 0, reorderLevel: parseInt(form.reorderLevel) || 0,
        isActive: form.isActive, imageUrl: imageUrl || null,
        hsnCode: form.hsnCode || null, packing: form.packing || null,
        unitsPerBox: parseInt(form.unitsPerBox) || 1, retailUnits: parseInt(form.retailUnits) || 1,
        minQuantity: parseInt(form.minQuantity) || 1, storageLocation: form.storageLocation || null,
        schedule: form.schedule || null, scheme: form.scheme || null,
        barcode: form.barcode || null, batchNumber: form.batchNumber || null,
        expiryDate: form.expiryDate || null,
      }
      if (isNew) {
        await productsApi.create(payload)
        setSuccess('Product created!')
        setTimeout(() => router.push('/admin/products'), 900)
      } else {
        await productsApi.update(id, payload)
        setSuccess('Product updated!')
      }
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (authLoading || !user || user.role !== 'ADMIN') return null

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  const companyOpts = companies.map(c => ({ value: c.id, label: c.name }))
  const compositionOpts = compositions.map(c => ({ value: c.id, label: c.name }))
  const gstOpts = gstRates.map(g => ({ value: g.id, label: `${g.name} (${g.percentage}%)` }))
  const categoryOpts = categories.map(c => ({ value: c.name, label: c.name }))
  const dosageOpts = DOSAGE_FORMS.map(d => ({ value: d, label: d }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/admin/products')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'Add New Product' : 'Edit Product'}</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error   && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

          {/* ── Basic Information ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Product Name" required>
                <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required />
              </Field>
              <Field label="SKU / Product Code" required>
                <input className={inp} value={form.sku} onChange={e => set('sku', e.target.value)} required />
              </Field>

              <Field label="Company">
                <SearchableSelect
                  options={companyOpts}
                  value={form.companyId}
                  onChange={handleCompanyChange}
                  placeholder="Select company…"
                />
                {!form.companyId && (
                  <input className={`${inp} mt-1`} value={form.companyName}
                    onChange={e => set('companyName', e.target.value)} placeholder="Or type manually" />
                )}
              </Field>

              <Field label="Composition">
                <SearchableSelect
                  options={compositionOpts}
                  value={form.compositionId}
                  onChange={handleCompositionChange}
                  placeholder="Select composition…"
                  onAddNew={handleAddComposition}
                  addNewLabel="Create composition"
                />
              </Field>

              <Field label="Dosage Form">
                <SearchableSelect options={dosageOpts} value={form.dosageForm} onChange={v => set('dosageForm', v)} placeholder="Select dosage form…" />
              </Field>

              <Field label="Category">
                <SearchableSelect options={categoryOpts} value={form.category} onChange={v => set('category', v)} placeholder="Select category…" />
              </Field>

              <Field label="Strength">
                <input className={inp} value={form.strength} onChange={e => set('strength', e.target.value)} placeholder="e.g. 500mg, 10ml" />
              </Field>

              <Field label="Schedule">
                <select className={inp} value={form.schedule} onChange={e => set('schedule', e.target.value)}>
                  {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Manufacturer">
                <input className={inp} value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
              </Field>

              <Field label="Status">
                <select className={inp} value={form.isActive ? 'active' : 'inactive'} onChange={e => set('isActive', e.target.value === 'active')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>

              <Field label="Description" span2>
                <textarea className={inp} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
              </Field>

              {/* Show ingredients as read-only when linked to composition */}
              <Field label="Ingredients / Composition (text)" span2>
                <textarea className={inp} rows={2} value={form.ingredients}
                  onChange={e => set('ingredients', e.target.value)}
                  placeholder="Auto-filled when composition selected, or type manually" />
              </Field>
            </div>
          </div>

          {/* ── Pricing & GST ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Pricing & GST</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="MRP (₹)" required>
                <input className={inp} type="number" step="0.01" min="0" value={form.mrp} onChange={e => set('mrp', e.target.value)} required />
              </Field>
              <Field label="Selling / Offer Price (₹)" required>
                <input className={inp} type="number" step="0.01" min="0" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} required />
              </Field>
              <Field label="Discount %">
                <input className={inp} type="number" step="0.01" min="0" max="100" value={form.discountPct} onChange={e => set('discountPct', e.target.value)} />
              </Field>
              <Field label="GST Rate">
                <SearchableSelect options={gstOpts} value={form.gstId} onChange={handleGstChange} placeholder="Select GST…" />
              </Field>
              <Field label="GST % (manual override)">
                <input className={inp} type="number" step="0.01" min="0" value={form.gstPct} onChange={e => set('gstPct', e.target.value)} />
              </Field>
              <Field label="HSN Code">
                <input className={inp} value={form.hsnCode} onChange={e => set('hsnCode', e.target.value)} placeholder="e.g. 3004" />
              </Field>
            </div>
          </div>

          {/* ── Packing & Units ───────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Packing & Units</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Packing">
                <input className={inp} value={form.packing} onChange={e => set('packing', e.target.value)} placeholder="e.g. 10×10" />
              </Field>
              <Field label="Units per Box">
                <input className={inp} type="number" min="1" value={form.unitsPerBox} onChange={e => set('unitsPerBox', e.target.value)} />
              </Field>
              <Field label="Retail Units">
                <input className={inp} type="number" min="1" value={form.retailUnits} onChange={e => set('retailUnits', e.target.value)} />
              </Field>
              <Field label="Min Order Qty">
                <input className={inp} type="number" min="1" value={form.minQuantity} onChange={e => set('minQuantity', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ── Batch / Expiry / Barcode ──────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Batch, Barcode & Storage</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Batch Number">
                <input className={inp} value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)} />
              </Field>
              <Field label="Expiry Date">
                <input className={inp} type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
              </Field>
              <Field label="Barcode">
                <input className={inp} value={form.barcode} onChange={e => set('barcode', e.target.value)} />
              </Field>
              <Field label="Storage Location">
                <input className={inp} value={form.storageLocation} onChange={e => set('storageLocation', e.target.value)} placeholder="e.g. Rack A-3" />
              </Field>
              <Field label="Scheme / Offer">
                <input className={inp} value={form.scheme} onChange={e => set('scheme', e.target.value)} placeholder="e.g. 10+1 free" />
              </Field>
            </div>
          </div>

          {/* ── Image ────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Product Image</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <FileUpload label="Choose from gallery" onFile={dataUrl => setImageDataUrl(dataUrl)} accept="image/*" />
              <FileUpload label="Capture from camera" onFile={dataUrl => setImageDataUrl(dataUrl)} accept="image/*" capture="environment" />
            </div>
            {(imageDataUrl || form.imageUrl) && (
              <div className="mt-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl || getImageUrl(form.imageUrl)} alt="Preview"
                  className="h-20 w-20 rounded-lg object-cover border border-gray-200 shadow-sm" />
                <div className="text-sm text-gray-500">
                  {imageDataUrl
                    ? <span className="text-green-600 font-medium">New image selected — saved on submit</span>
                    : <span>Current image</span>}
                  {imageDataUrl && (
                    <button type="button" onClick={() => setImageDataUrl('')}
                      className="block mt-1 text-xs text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Inventory ────────────────────────────────────────────────── */}
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
  )
}
