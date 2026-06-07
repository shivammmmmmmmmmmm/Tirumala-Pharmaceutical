import AppShell from '@/components/AppShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requiredRole="ADMIN">{children}</AppShell>
}
