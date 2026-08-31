import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js'
import type { PaginatedResponse } from '../types.js'

const router: Router = Router()

function fmt(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    companyName: p.company_name || '',
    companyId: p.company_id || null,
    compositionId: p.composition_id || null,
    gstId: p.gst_id || null,
    category: p.category || '',
    description: p.description || '',
    ingredients: p.ingredients || '',
    strength: p.strength || '',
    dosageForm: p.dosage_form || '',
    mrp: Number(p.mrp) || 0,
    sellingPrice: Number(p.selling_price) || 0,
    discountPct: Number(p.discount_pct) || 0,
    gstPct: Number(p.gst_pct) || 0,
    sku: p.sku,
    manufacturer: p.manufacturer || '',
    quantity: Number(p.quantity) || 0,
    reorderLevel: Number(p.reorder_level) || 0,
    imageUrl: p.image_url || null,
    isActive: Boolean(p.is_active),
    // new pharma fields
    hsnCode: p.hsn_code || null,
    packing: p.packing || null,
    unitsPerBox: Number(p.units_per_box) || 1,
    retailUnits: Number(p.retail_units) || 1,
    minQuantity: Number(p.min_quantity) || 1,
    storageLocation: p.storage_location || null,
    schedule: p.schedule || null,
    scheme: p.scheme || null,
    barcode: p.barcode || null,
    batchNumber: p.batch_number || null,
    expiryDate: p.expiry_date || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

function now() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

/**
 * Token-based search: splits query on spaces/hyphens/underscores,
 * then requires ALL tokens to match at least one of the search columns.
 */
function buildTokenSearch(raw: string): { clause: string; params: unknown[] } {
  const tokens = raw
    .toLowerCase()
    .split(/[\s\-_]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 1)

  if (tokens.length === 0) return { clause: '', params: [] }

  const params: unknown[] = []
  const tokenClauses = tokens.map(tok => {
    const like = `%${tok}%`
    params.push(like, like, like, like, like, like, like)
    return `(
      LOWER(name) LIKE ?
      OR LOWER(COALESCE(ingredients,'')) LIKE ?
      OR LOWER(COALESCE(company_name,'')) LIKE ?
      OR LOWER(COALESCE(strength,'')) LIKE ?
      OR LOWER(COALESCE(dosage_form,'')) LIKE ?
      OR LOWER(COALESCE(category,'')) LIKE ?
      OR LOWER(sku) LIKE ?
    )`
  })

  return { clause: tokenClauses.join(' AND '), params }
}

// ── GET / — list products with token search + cascading filters ───────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20)
    const search   = ((req.query.search as string) || '').trim()
    const category   = ((req.query.category as string) || '').trim()
    const ingredient = ((req.query.ingredient as string) || '').trim()
    const company    = ((req.query.company as string) || '').trim()
    const companyId  = ((req.query.companyId as string) || '').trim()
    const compositionId = ((req.query.compositionId as string) || '').trim()
    const dosageForm = ((req.query.dosageForm as string) || '').trim()
    const offset   = (page - 1) * pageSize

    const conds: string[] = ['is_active = 1']
    const params: unknown[] = []

    // Token-based search
    if (search.length >= 1) {
      const { clause, params: tParams } = buildTokenSearch(search)
      if (clause) { conds.push(`(${clause})`); params.push(...tParams) }
    }
    if (ingredient.length >= 2) { conds.push(`LOWER(COALESCE(ingredients,'')) LIKE ?`); params.push(`%${ingredient.toLowerCase()}%`) }
    if (company.length >= 1)    { conds.push(`(LOWER(COALESCE(company_name,'')) LIKE ? OR LOWER(COALESCE(manufacturer,'')) LIKE ?)`); params.push(`%${company.toLowerCase()}%`, `%${company.toLowerCase()}%`) }
    if (companyId)              { conds.push(`company_id = ?`); params.push(companyId) }
    if (compositionId)          { conds.push(`composition_id = ?`); params.push(compositionId) }
    if (dosageForm)             { conds.push(`LOWER(COALESCE(dosage_form,'')) = ?`); params.push(dosageForm.toLowerCase()) }
    if (category)               { conds.push(`category = ?`); params.push(category) }

    const where = `WHERE ${conds.join(' AND ')}`

    const [totalRow, products] = await Promise.all([
      queryOne<Record<string, unknown>>(`SELECT COUNT(*) as c FROM products ${where}`, params),
      query<Record<string, unknown>>(
        `SELECT * FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
    ])

    return res.json({
      success: true,
      data: {
        data: products.map(p => fmt(p as RowDataPacket)),
        total: Number(totalRow?.c ?? 0),
        page, pageSize,
        totalPages: Math.ceil(Number(totalRow?.c ?? 0) / pageSize),
      } as PaginatedResponse<unknown>,
    })
  } catch (e) {
    console.error('List products error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── GET /filter-options — distinct values for cascading dropdowns ─────────────
router.get('/filter-options', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const dosageForm  = ((req.query.dosageForm as string) || '').trim()
    const companyId   = ((req.query.companyId as string) || '').trim()
    const compositionId = ((req.query.compositionId as string) || '').trim()

    const base = `FROM products WHERE is_active=1`

    // Dosage forms (always unrestricted)
    const dosageForms = await query<RowDataPacket>(
      `SELECT DISTINCT dosage_form as val FROM products WHERE is_active=1 AND dosage_form IS NOT NULL AND dosage_form != '' ORDER BY dosage_form`
    )

    // Companies — filtered by dosage form if chosen
    // The filter value is a company ID, so omit manually entered company names
    // that have no master-company ID. They cannot be selected or filtered reliably.
    const compConds = ['is_active=1', "COALESCE(company_id,'') != ''"]
    const compParams: unknown[] = []
    if (dosageForm) { compConds.push(`LOWER(COALESCE(dosage_form,'')) = ?`); compParams.push(dosageForm.toLowerCase()) }
    const companies = await query<RowDataPacket>(
      `SELECT DISTINCT company_id as id, company_name as name FROM products WHERE ${compConds.join(' AND ')} AND company_name IS NOT NULL AND company_name != '' ORDER BY company_name`,
      compParams
    )

    // Products — filtered by dosage form + company
    const prodConds = ['is_active=1']
    const prodParams: unknown[] = []
    if (dosageForm)  { prodConds.push(`LOWER(COALESCE(dosage_form,'')) = ?`); prodParams.push(dosageForm.toLowerCase()) }
    if (companyId)   { prodConds.push(`company_id = ?`); prodParams.push(companyId) }
    else if (companyId === '' && companies.length && !dosageForm) { /* no company filter */ }
    const prodList = await query<RowDataPacket>(
      `SELECT id, name FROM products WHERE ${prodConds.join(' AND ')} ORDER BY name`,
      prodParams
    )

    // Compositions — filtered by dosage form + company + product
    const compoConds = ['is_active=1', "COALESCE(composition_id,'') != ''"]
    const compoParams: unknown[] = []
    if (dosageForm)     { compoConds.push(`LOWER(COALESCE(dosage_form,'')) = ?`); compoParams.push(dosageForm.toLowerCase()) }
    if (companyId)      { compoConds.push(`company_id = ?`); compoParams.push(companyId) }
    if (compositionId)  { compoConds.push(`composition_id = ?`); compoParams.push(compositionId) }
    const compositions = await query<RowDataPacket>(
      `SELECT DISTINCT composition_id as id FROM products WHERE ${compoConds.join(' AND ')}`,
      compoParams
    )
    const compositionIds = compositions.map(c => c.id).filter(Boolean)
    let compositionRows: RowDataPacket[] = []
    if (compositionIds.length > 0) {
      const placeholders = compositionIds.map(() => '?').join(',')
      compositionRows = await query<RowDataPacket>(
        `SELECT id, name FROM compositions WHERE id IN (${placeholders}) AND is_active=1 ORDER BY name`,
        compositionIds
      )
    }

    return res.json({
      success: true,
      data: {
        dosageForms: dosageForms.map(r => r.val),
        companies: companies.map(r => ({ id: r.id, name: r.name })),
        products: prodList.map(r => ({ id: r.id, name: r.name })),
        compositions: compositionRows.map(r => ({ id: r.id, name: r.name })),
      },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── GET /categories ───────────────────────────────────────────────────────────
router.get('/categories', authMiddleware, async (_req, res) => {
  try {
    const cats = await query<RowDataPacket>(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND is_active=1 ORDER BY category'
    )
    return res.json({ success: true, data: cats.map(c => c.category) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const p = await queryOne<RowDataPacket>('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (!p) return res.status(404).json({ success: false, error: 'Product not found' })
    return res.json({ success: true, data: fmt(p) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── POST / — create ───────────────────────────────────────────────────────────
router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, companyName, companyId, compositionId, gstId, category, description, ingredients,
      strength, dosageForm, mrp, sellingPrice, discountPct, gstPct, sku, manufacturer,
      quantity, reorderLevel, imageUrl, hsnCode, packing, unitsPerBox, retailUnits,
      minQuantity, storageLocation, schedule, scheme, barcode, batchNumber, expiryDate,
    } = req.body
    if (!name || !sku) return res.status(400).json({ success: false, error: 'name and sku required' })
    if (await queryOne('SELECT id FROM products WHERE sku = ?', [sku])) {
      return res.status(409).json({ success: false, error: 'SKU already exists' })
    }
    const id = uuidv4(); const ts = now()
    await run(
      `INSERT INTO products (id,name,company_name,company_id,composition_id,gst_id,category,description,ingredients,
       strength,dosage_form,mrp,selling_price,discount_pct,gst_pct,sku,manufacturer,quantity,reorder_level,image_url,
       hsn_code,packing,units_per_box,retail_units,min_quantity,storage_location,schedule,scheme,barcode,
       batch_number,expiry_date,is_active,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        id, name, companyName||null, companyId||null, compositionId||null, gstId||null,
        category||null, description||null, ingredients||null, strength||null, dosageForm||null,
        mrp||0, sellingPrice||0, discountPct||0, gstPct||12, sku, manufacturer||null,
        quantity||0, reorderLevel||0, imageUrl||null,
        hsnCode||null, packing||null, unitsPerBox||1, retailUnits||1, minQuantity||1,
        storageLocation||null, schedule||null, scheme||null, barcode||null,
        batchNumber||null, expiryDate||null, ts, ts,
      ]
    )
    const created = await queryOne<RowDataPacket>('SELECT * FROM products WHERE id=?', [id])
    return res.status(201).json({ success: true, data: fmt(created!) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── PUT /:id — update ─────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await queryOne('SELECT id FROM products WHERE id=?', [id]))) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    const fields: Record<string, string> = {
      name: 'name', companyName: 'company_name', companyId: 'company_id',
      compositionId: 'composition_id', gstId: 'gst_id',
      category: 'category', description: 'description', ingredients: 'ingredients',
      strength: 'strength', dosageForm: 'dosage_form',
      mrp: 'mrp', sellingPrice: 'selling_price', discountPct: 'discount_pct', gstPct: 'gst_pct',
      manufacturer: 'manufacturer', quantity: 'quantity', reorderLevel: 'reorder_level',
      imageUrl: 'image_url', isActive: 'is_active',
      hsnCode: 'hsn_code', packing: 'packing', unitsPerBox: 'units_per_box',
      retailUnits: 'retail_units', minQuantity: 'min_quantity', storageLocation: 'storage_location',
      schedule: 'schedule', scheme: 'scheme', barcode: 'barcode',
      batchNumber: 'batch_number', expiryDate: 'expiry_date',
    }
    const sets = ['updated_at = ?']; const params: unknown[] = [now()]
    for (const [key, col] of Object.entries(fields)) {
      if (req.body[key] !== undefined) {
        sets.push(`${col} = ?`)
        params.push(key === 'isActive' ? (req.body[key] ? 1 : 0) : req.body[key])
      }
    }
    params.push(id)
    await run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, params)
    const updated = await queryOne<RowDataPacket>('SELECT * FROM products WHERE id=?', [id])
    return res.json({ success: true, data: fmt(updated!) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ── DELETE /:id — deactivate ──────────────────────────────────────────────────
router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await queryOne('SELECT id FROM products WHERE id=?', [req.params.id]))) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    await run('UPDATE products SET is_active=0, updated_at=? WHERE id=?', [now(), req.params.id])
    return res.json({ success: true, message: 'Product deactivated' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
