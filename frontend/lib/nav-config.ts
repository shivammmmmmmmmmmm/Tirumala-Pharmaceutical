import type { UserRole } from './types'

export type NavItem = { href: string; label: string }
export type NavGroup = { label: string; href?: string; items?: NavItem[] }

export const NAV_BY_ROLE: Record<UserRole, NavGroup[]> = {
  ADMIN: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    {
      label: 'Catalog',
      items: [
        { href: '/admin/products', label: 'Products' },
        { href: '/admin/categories', label: 'Categories' },
        { href: '/admin/inventory', label: 'Inventory' },
        { href: '/admin/pricing', label: 'Pricing' },
      ],
    },
    {
      label: 'Orders',
      items: [
        { href: '/admin/orders', label: 'All orders' },
        { href: '/admin/approvals', label: 'Approvals' },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/admin/users', label: 'Customers' },
        { href: '/admin/sales-persons', label: 'Sales team' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { href: '/admin/accounting', label: 'Accounting' },
        { href: '/admin/backup', label: 'Backup' },
        { href: '/admin/commissions', label: 'Commissions' },
        { href: '/admin/reports', label: 'Reports' },
        { href: '/admin/audit-logs', label: 'Audit logs' },
      ],
    },
  ],
  USER: [
    { label: 'Dashboard', href: '/user/dashboard' },
    {
      label: 'Shop',
      items: [
        { href: '/user/products', label: 'Browse products' },
        { href: '/user/checkout', label: 'Checkout' },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/user/orders', label: 'My orders' },
        { href: '/user/payments', label: 'Payments' },
        { href: '/user/ledger', label: 'Ledger' },
      ],
    },
  ],
  SALES_PERSON: [
    { label: 'Dashboard', href: '/sp/dashboard' },
    {
      label: 'Sales',
      items: [
        { href: '/sp/place-order', label: 'Place order' },
        { href: '/sp/orders', label: 'Orders' },
        { href: '/sp/delivery', label: 'Delivery' },
        { href: '/sp/territories', label: 'Territories' },
      ],
    },
    {
      label: 'Customers',
      href: '/sp/customers',
    },
    {
      label: 'Performance',
      items: [
        { href: '/sp/performance', label: 'Metrics' },
        { href: '/sp/commissions', label: 'Commissions' },
      ],
    },
  ],
}

export function dashboardPathForRole(role: UserRole) {
  if (role === 'ADMIN') return '/admin/dashboard'
  if (role === 'SALES_PERSON') return '/sp/dashboard'
  return '/user/dashboard'
}
