'use client'

import Link from 'next/link'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  showLicenses?: boolean
  href?: string
  className?: string
}

const SIZES = {
  sm: { logo: 'h-8 w-8', title: 'text-sm', tagline: 'text-[10px]' },
  md: { logo: 'h-10 w-10', title: 'text-base', tagline: 'text-xs' },
  lg: { logo: 'h-24 w-24', title: 'text-2xl', tagline: 'text-sm' },
}

export function TirumalaBrand({ size = 'md', showTagline = false, showLicenses = false, href, className = '' }: Props) {
  const s = SIZES[size]
  const inner = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/tirumala logo.jpeg"
        alt="Tirumala Pharmaceutical"
        className={`${s.logo} rounded-xl shadow-md object-cover shrink-0`}
      />
      <div className="min-w-0">
        <p className={`${s.title} font-bold text-slate-900 tracking-tight leading-tight`}>
          Tirumala <span className="text-emerald-700">Pharmaceutical</span>
        </p>
        {showTagline && (
          <p className={`${s.tagline} text-slate-500 mt-0.5 leading-snug`}>
            Wholesale Distributor for Surgical, Generic &amp; Pharma
          </p>
        )}
        {showLicenses && (
          <div className={`${s.tagline} text-slate-400 mt-1 space-y-0.5`}>
            <p>DL: 20B-MH-NAN-421269 · 21B-MH-NAN-421270</p>
            <p>GST: 27AARFT2122K1ZW</p>
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="shrink-0 group">{inner}</Link>
  }
  return inner
}

export function TirumalaFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/60 backdrop-blur py-4 px-4 text-center">
      <TirumalaBrand size="sm" showTagline className="justify-center mb-2" />
      <p className="text-[10px] text-slate-400 leading-relaxed">
        DL 20B-MH-NAN-421269 · 21B-MH-NAN-421270 · GST 27AARFT2122K1ZW
      </p>
    </footer>
  )
}
