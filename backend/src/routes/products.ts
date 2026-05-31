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
    category: p.category || '',
    description: p.description || '',
    ingredients: p.ingredients || '',
    strength: p.strength || '',
    dosageForm: p.dosage_form || '',
    mrp: Number(p.mrp) || 0,
    sellingPrice: Number(p.selling_price) || 0,
    discountPct: Number(p.discount_pct) || 0,
    sku: p.sku,
    manufacturer: p.manufacturer || '',
    quantity: Number(p.quantity) || 0,
    reorderLevel: Number(p.reorder_level) || 0,
    imageUrl: p.image_url || null,
    isActive: Boolean(p.is_active),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20)
    const search = ((req.query.search as string) || '').trim()
    const category = ((req.query.category as string) || '').trim()
    const offset = (page - 1) * pageSize

    const conds: string[] = ['is_active = 1']
    const params: unknown[] = []

    if (search.length >= 2) {
      // Prefer FULLTEXT if available (much faster than multi-column LIKE).
      // Fallback to LIKE remains for older DBs/schemas.
      conds.push(`(
        MATCH(name, description, manufacturer) AGAINST (? IN BOOLEAN MODE)
        OR (name LIKE ? OR sku LIKE ? OR category LIKE ? OR description LIKE ? OR manufacturer LIKE ? OR COALESCE(company_name,'') LIKE ?)
      )`)
      const like = `%${search}%`
      // For BOOLEAN MODE, wrap terms with wildcards to mimic substring search.
      const booleanSearch = search
        .split(/\s+/)
        .filter(Boolean)
        .map(t => `${t}*`)
        .join(' ')

      params.push(booleanSearch, like, like, like, like, like, like)
    }
    if (category) {
      conds.push('category = ?')
      params.push(category)
    }

    const where = `WHERE ${conds.join(' AND ')}`
    // Run both queries concurrently to reduce endpoint latency.
    const [totalRow, products] = await Promise.all([
      queryOne<Record<string, unknown>>(`SELECT COUNT(*) as c FROM products ${where}`, params),
      query<Record<string, unknown>>(
        `SELECT * FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
    ])

    const total = Number(totalRow?.c ?? 0)


    return res.json({
      success: true,
      data: {
        data: products.map(p => fmt(p as RowDataPacket)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      } as PaginatedResponse<unknown>,
    })
  } catch (e) {
    console.error('List products error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

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

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const p = await queryOne<RowDataPacket>('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (!p) return res.status(404).json({ success: false, error: 'Product not found' })
    return res.json({ success: true, data: fmt(p) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, companyName, category, description, ingredients, strength, dosageForm,
      mrp, sellingPrice, discountPct, sku, manufacturer, quantity, reorderLevel, imageUrl,
    } = req.body
    if (!name || !sku) return res.status(400).json({ success: false, error: 'name and sku required' })
    if (await queryOne('SELECT id FROM products WHERE sku = ?', [sku])) {
      return res.status(409).json({ success: false, error: 'SKU already exists' })
    }
    const id = uuidv4()
    const ts = now()
    await run(
      `INSERT INTO products (id,name,company_name,category,description,ingredients,strength,dosage_form,
       mrp,selling_price,discount_pct,sku,manufacturer,quantity,reorder_level,image_url,is_active,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        id, name, companyName || null, category || null, description || null, ingredients || null,
        strength || null, dosageForm || null, mrp || 0, sellingPrice || 0, discountPct || 0, sku,
        manufacturer || null, quantity || 0, reorderLevel || 0, imageUrl || null, ts, ts,
      ]
    )
    const created = await queryOne<RowDataPacket>('SELECT * FROM products WHERE id=?', [id])
    return res.status(201).json({ success: true, data: fmt(created!) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await queryOne('SELECT id FROM products WHERE id=?', [id]))) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    const fields: Record<string, string> = {
      name: 'name', companyName: 'company_name', category: 'category', description: 'description',
      ingredients: 'ingredients', strength: 'strength', dosageForm: 'dosage_form',
      mrp: 'mrp', sellingPrice: 'selling_price', discountPct: 'discount_pct',
      manufacturer: 'manufacturer', quantity: 'quantity', reorderLevel: 'reorder_level',
      imageUrl: 'image_url', isActive: 'is_active',
    }
    const sets = ['updated_at = ?']
    const params: unknown[] = [now()]
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
