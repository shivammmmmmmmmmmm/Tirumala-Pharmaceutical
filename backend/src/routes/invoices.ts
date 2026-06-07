import { Router, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { query, queryOne } from '../db/index.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { formatOrder } from '../utils/formatters.js'

const router: Router = Router()

router.get('/:orderId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const o = await queryOne<RowDataPacket>(
      `SELECT o.*, u.name as user_name, u.organization_name as user_org, u.address as user_address,
              u.phone as user_phone, sp.name as sp_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN users sp ON o.sp_id = sp.id
       WHERE o.id = ?`,
      [req.params.orderId]
    )
    if (!o) return res.status(404).json({ success: false, error: 'Order not found' })

    if (role === 'USER' && o.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (role === 'SALES_PERSON' && o.sp_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const items = await query<RowDataPacket>('SELECT * FROM order_items WHERE order_id = ?', [req.params.orderId])
    const order = formatOrder(o, items)
    const invoice = {
      invoiceNumber: `INV-${order.orderNumber}`,
      issuedAt: new Date().toISOString(),
      seller: { name: 'Medical Distribution Co.', gstin: 'GSTIN-PENDING' },
      buyer: {
        name: o.user_name,
        organization: o.user_org,
        address: o.user_address,
        phone: o.user_phone,
      },
      order,
      totals: {
        subtotal: order.subtotal,
        discount: order.discountAmount,
        gstAmount: Number(o.gst_amount ?? 0),
        gstPct: 12,
        total: order.totalAmount,
        paid: order.paidAmount,
        due: order.totalAmount - order.paidAmount,
      },
    }
    return res.json({ success: true, data: invoice })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
