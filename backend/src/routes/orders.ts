import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne, run } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatOrder } from '../utils/formatters.js'

const router: Router = Router()

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function canAccessOrder(role: string, userId: string, order: RowDataPacket): Promise<boolean> {
  if (role === 'ADMIN') return true
  if (role === 'USER') return order.user_id === userId
  if (role === 'SALES_PERSON') return order.sp_id === userId
  return false
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20)
    const status = req.query.status as string
    const offset = (page - 1) * pageSize

    const conds: string[] = []
    const params: unknown[] = []

    if (role === 'USER') {
      conds.push('o.user_id = ?')
      params.push(userId)
    } else if (role === 'SALES_PERSON') {
      conds.push('o.sp_id = ?')
      params.push(userId)
    }
    if (status) {
      conds.push('o.status = ?')
      params.push(status)
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const totalRow = await queryOne<RowDataPacket>(`SELECT COUNT(*) as c FROM orders o ${where}`, params)
    const total = Number(totalRow?.c ?? 0)
    const orders = await query<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, sp.name as sp_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN users sp ON o.sp_id = sp.id
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    return res.json({
      success: true,
      data: { data: orders.map(o => formatOrder(o)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const o = await queryOne<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, sp.name as sp_name
       FROM orders o LEFT JOIN users u ON o.user_id=u.id LEFT JOIN users sp ON o.sp_id=sp.id
       WHERE o.id = ?`,
      [req.params.id]
    )
    if (!o) return res.status(404).json({ success: false, error: 'Order not found' })
    if (!(await canAccessOrder(role, userId, o))) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id = ?', [req.params.id])
    return res.json({ success: true, data: formatOrder(o, items) })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    const { items, paymentMethod, shippingAddress, notes, targetUserId } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must have at least one item' })
    }

    let orderUserId = userId
    if (role === 'SALES_PERSON' && targetUserId) {
      const customer = await queryOne<RowDataPacket>(
        'SELECT * FROM users WHERE id = ? AND role = ? AND assigned_sp_id = ?',
        [targetUserId, 'USER', userId]
      )
      if (!customer) {
        return res.status(403).json({ success: false, error: 'Customer not assigned to you' })
      }
      orderUserId = targetUserId
    } else if (role !== 'USER') {
      return res.status(403).json({ success: false, error: 'Only customers can place orders directly' })
    }

    const user = await queryOne<RowDataPacket>('SELECT * FROM users WHERE id=?', [orderUserId])
    if (!user) return res.status(404).json({ success: false, error: 'User not found' })

    const spRow = await queryOne<RowDataPacket>('SELECT assigned_sp_id FROM users WHERE id=?', [orderUserId])
    const spId = role === 'SALES_PERSON' ? userId : spRow?.assigned_sp_id || null

    let subtotal = 0
    let discountAmount = 0
    const resolvedItems: { product: RowDataPacket; quantity: number; unitPrice: number; discountPct: number; totalPrice: number }[] = []

    for (const item of items) {
      const product = await queryOne<RowDataPacket>(
        'SELECT * FROM products WHERE id=? AND is_active=1',
        [item.productId]
      )
      if (!product) return res.status(400).json({ success: false, error: `Product ${item.productId} not found` })
      if (product.quantity < item.quantity) {
        return res.status(400).json({ success: false, error: `Insufficient stock for ${product.name}` })
      }
      const unitPrice = Number(product.selling_price)
      const disc = Number(product.discount_pct) || 0
      const lineTotal = unitPrice * item.quantity * (1 - disc / 100)
      subtotal += unitPrice * item.quantity
      discountAmount += unitPrice * item.quantity * (disc / 100)
      resolvedItems.push({ product, quantity: item.quantity, unitPrice, discountPct: disc, totalPrice: lineTotal })
    }

    const totalAmount = subtotal - discountAmount
    const pm = paymentMethod || 'CREDIT'

    if (pm === 'CREDIT') {
      const available = Number(user.credit_limit || 0) - Number(user.credit_used || 0)
      if (totalAmount > available) {
        return res.status(400).json({
          success: false,
          error: `Insufficient credit. Available: ₹${available.toFixed(2)}`,
        })
      }
    }

    const orderId = uuidv4()
    const orderNumber = `ORD-${Date.now()}`
    const ts = now()

    await run(
      `INSERT INTO orders (id,order_number,user_id,sp_id,status,payment_method,payment_status,
       subtotal,discount_amount,total_amount,paid_amount,notes,shipping_address,created_at,updated_at)
       VALUES (?,?,?,?,'PENDING',?,?,?,?,?,0,?,?,?,?)`,
      [
        orderId, orderNumber, orderUserId, spId, pm, pm === 'CREDIT' ? 'PENDING' : 'PAID',
        subtotal, discountAmount, totalAmount, notes || null, shippingAddress || null, ts, ts,
      ]
    )

    for (const ri of resolvedItems) {
      await run(
        `INSERT INTO order_items (id,order_id,product_id,product_name,quantity,unit_price,discount_pct,total_price)
         VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), orderId, ri.product.id, ri.product.name, ri.quantity, ri.unitPrice, ri.discountPct, ri.totalPrice]
      )
      await run('UPDATE products SET quantity = quantity - ?, updated_at=? WHERE id=?', [
        ri.quantity, ts, ri.product.id,
      ])
    }

    if (pm === 'CREDIT') {
      await run('UPDATE users SET credit_used = credit_used + ?, updated_at=? WHERE id=?', [
        totalAmount, ts, orderUserId,
      ])
      const newBalance = Number(user.credit_used || 0) + totalAmount
      await run(
        `INSERT INTO ledger (id,user_id,type,amount,balance_after,description,reference_id,reference_type,created_at)
         VALUES (?,?,'DEBIT',?,?,?,?,'ORDER',?)`,
        [uuidv4(), orderUserId, totalAmount, newBalance, `Order ${orderNumber}`, orderId, ts]
      )
    }

    if (spId) {
      const sp = await queryOne<RowDataPacket>('SELECT commission_pct FROM users WHERE id=?', [spId])
      const pct = Number(sp?.commission_pct || 0)
      if (pct > 0) {
        await run(
          `INSERT INTO commissions (id,sp_id,order_id,order_amount,commission_pct,commission_amount,status,created_at,updated_at)
           VALUES (?,?,?,?,?,?,'PENDING',?,?)`,
          [uuidv4(), spId, orderId, totalAmount, pct, totalAmount * pct / 100, ts, ts]
        )
      }
    }

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [orderId])
    const items2 = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [orderId])
    return res.status(201).json({ success: true, data: formatOrder(order!, items2) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['ADMIN', 'SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const { status } = req.body
    const valid = ['PENDING', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' })

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const ts = now()
    if (status === 'DELIVERED') {
      await run('UPDATE orders SET status=?, updated_at=?, delivered_at=? WHERE id=?', [status, ts, ts, req.params.id])
    } else {
      await run('UPDATE orders SET status=?, updated_at=? WHERE id=?', [status, ts, req.params.id])
    }

    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      const orderItems = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
      for (const item of orderItems) {
        await run('UPDATE products SET quantity=quantity+?, updated_at=? WHERE id=?', [
          item.quantity, ts, item.product_id,
        ])
      }
      if (order.payment_method === 'CREDIT') {
        await run('UPDATE users SET credit_used=credit_used-?, updated_at=? WHERE id=?', [
          order.total_amount, ts, order.user_id,
        ])
        const u = await queryOne<RowDataPacket>('SELECT credit_used FROM users WHERE id=?', [order.user_id])
        await run(
          `INSERT INTO ledger (id,user_id,type,amount,balance_after,description,reference_id,reference_type,created_at)
           VALUES (?,?,'CREDIT',?,?,?,?,'ORDER_CANCEL',?)`,
          [
            uuidv4(), order.user_id, order.total_amount, u?.credit_used || 0,
            `Cancelled: ${order.order_number}`, req.params.id, ts,
          ]
        )
      }
    }

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [req.params.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

router.post('/:id/payment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['ADMIN', 'SALES_PERSON'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const { amount } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Valid amount required' })

    const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [req.params.id])
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' })
    if (role === 'SALES_PERSON' && order.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const newPaid = Number(order.paid_amount || 0) + amount
    const payStatus = newPaid >= Number(order.total_amount) ? 'PAID' : 'PARTIAL'
    const ts = now()
    await run('UPDATE orders SET paid_amount=?, payment_status=?, updated_at=? WHERE id=?', [
      newPaid, payStatus, ts, order.id,
    ])

    if (order.payment_method === 'CREDIT') {
      await run('UPDATE users SET credit_used=credit_used-?, updated_at=? WHERE id=?', [amount, ts, order.user_id])
      const u = await queryOne<RowDataPacket>('SELECT credit_used FROM users WHERE id=?', [order.user_id])
      await run(
        `INSERT INTO ledger (id,user_id,type,amount,balance_after,description,reference_id,reference_type,created_at)
         VALUES (?,?,'CREDIT',?,?,?,?,'PAYMENT',?)`,
        [uuidv4(), order.user_id, amount, u?.credit_used || 0, `Payment for ${order.order_number}`, order.id, ts]
      )
    }

    const updated = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [order.id])
    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id=?', [order.id])
    return res.json({ success: true, data: formatOrder(updated!, items) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
