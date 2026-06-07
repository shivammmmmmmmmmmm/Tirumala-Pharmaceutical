import AppShell from '@/components/AppShell'

export default function SpLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requiredRole="SALES_PERSON">{children}</AppShell>
}
