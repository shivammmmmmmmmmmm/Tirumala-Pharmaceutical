import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavigationProgress    from '@/components/NavigationProgress'
import TapFeedback           from '@/components/TapFeedback'
import PageTransitionOverlay from '@/components/PageTransitionOverlay'
import Providers             from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Tirumala Pharmaceutical — Distribution System',
  description: 'Wholesale Distributor for Surgical, Generic & Pharma products. DL: 20B-MH-NAN-421269 / 21B-MH-NAN-421270 | GST: 27AARFT2122K1ZW',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tirumala Pharma' },
}

export const viewport: Viewport = {
  themeColor: '#1a3d2b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" style={{ fontFamily: "'Inter', sans-serif", background: '#f0f4ff' }}>
        <Providers>
          {/* Instant top progress bar on navigation */}
          <NavigationProgress />
          {/* Touch ripple on every button/link */}
          <TapFeedback />
          {/* Loading indicator the moment a link is tapped */}
          <PageTransitionOverlay />
          {children}
        </Providers>
      </body>
    </html>
  )
}
