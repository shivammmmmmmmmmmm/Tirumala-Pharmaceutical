import { v4 as uuidv4 } from 'uuid'
import type { RowDataPacket } from 'mysql2/promise'
import { queryOne, run } from '../db/index.js'
import { createNotification } from './notifications.js'

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function calculateCommission(totalAmount: number, type: string | null | undefined, value: number) {
  const commissionType = type === 'FIXED' ? 'FIXED' : 'PERCENTAGE'
  const commissionValue = Number(value || 0)
  if (commissionValue <= 0) throw new Error('Commission value must be greater than 0')
  const amount = commissionType === 'FIXED'
    ? Math.round(commissionValue * 100) / 100
    : Math.round(totalAmount * commissionValue) / 100
  const pctForLegacyColumn = commissionType === 'PERCENTAGE'
    ? commissionValue
    : totalAmount > 0 ? Math.round((amount / totalAmount) * 10000) / 100 : 0
  return { commissionType, commissionValue, amount, pctForLegacyColumn }
}

/** Admin sets commission after customer confirms receipt. */
export async function createCommissionForOrder(
  orderId: string,
  commissionPct: number,
  adminUserId: string
): Promise<{ id: string } | null> {
  const existing = await queryOne<RowDataPacket>('SELECT id FROM commissions WHERE order_id=?', [orderId])
  if (existing) return { id: String(existing.id) }

  const order = await queryOne<RowDataPacket>('SELECT * FROM orders WHERE id=?', [orderId])
  if (!order || !order.sp_id) return null
  if (String(order.receipt_status) !== 'CONFIRMED') {
    throw new Error('Customer must confirm receipt before commission can be set')
  }

  const totalAmount = Number(order.total_amount)
  const { amount, pctForLegacyColumn } = calculateCommission(totalAmount, 'PERCENTAGE', Number(commissionPct))
  const pct = pctForLegacyColumn
  const id = uuidv4()
  const ts = now()

  await run(
    `INSERT INTO commissions (id,sp_id,order_id,order_amount,commission_pct,commission_amount,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?,'PENDING',?,?)`,
    [id, order.sp_id, orderId, totalAmount, pct, amount, ts, ts]
  )

  const sp = await queryOne<RowDataPacket>('SELECT name FROM users WHERE id=?', [order.sp_id])
  await createNotification({
    userId: String(order.sp_id),
    type: 'COMMISSION_SET',
    title: 'Commission assigned',
    body: `₹${amount.toLocaleString('en-IN')} commission (${pct}%) set for order ${order.order_number} by admin.`,
    orderId,
    metadata: { commissionId: id, amount, pct },
  })

  return { id }
}
