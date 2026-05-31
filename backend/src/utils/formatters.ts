export function formatOrder(o: Record<string, unknown>, items: Record<string, unknown>[] = []) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    userId: o.user_id,
    spId: o.sp_id ?? null,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    subtotal: Number(o.subtotal),
    discountAmount: Number(o.discount_amount),
    totalAmount: Number(o.total_amount),
    paidAmount: Number(o.paid_amount),
    notes: o.notes ?? '',
    shippingAddress: o.shipping_address ?? '',
    deliveredAt: o.delivered_at ?? null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    userName: o.user_name ?? null,
    userOrg: o.user_org ?? null,
    spName: o.sp_name ?? null,
    items: items.map(i => ({
      id: i.id,
      orderId: i.order_id,
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      discountPct: Number(i.discount_pct),
      totalPrice: Number(i.total_price),
    })),
  }
}

export function formatCommission(c: Record<string, unknown>) {
  return {
    id: c.id,
    spId: c.sp_id,
    orderId: c.order_id,
    orderNumber: c.order_number ?? null,
    spName: c.sp_name ?? null,
    orderAmount: Number(c.order_amount),
    commissionPct: Number(c.commission_pct),
    commissionAmount: Number(c.commission_amount),
    status: c.status,
    paidAt: c.paid_at ?? null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export function formatLedger(e: Record<string, unknown>) {
  return {
    id: e.id,
    userId: e.user_id,
    type: e.type,
    amount: Number(e.amount),
    balanceAfter: Number(e.balance_after),
    description: e.description,
    referenceId: e.reference_id ?? null,
    referenceType: e.reference_type ?? null,
    createdAt: e.created_at,
  }
}
