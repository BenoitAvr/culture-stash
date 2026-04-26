'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavModes({ lang, labelLearn, labelRank }: { lang: string; labelLearn: string; labelRank: string }) {
  const pathname = usePathname()
  const isRank = pathname.startsWith(`/${lang}/rank`)

  const base: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'background .15s, color .15s',
  }

  return (
    <div style={{ display: 'flex', gap: 4, background: '#1a1a1a', borderRadius: 9, padding: 3, border: '1px solid #2a2a2a' }}>
      <Link
        href={`/${lang}`}
        style={{
          ...base,
          background: !isRank ? '#2a2a2a' : 'transparent',
          color: !isRank ? '#f0f0f0' : '#555',
        }}
      >
        {labelLearn}
      </Link>
      <Link
        href={`/${lang}/rank`}
        style={{
          ...base,
          background: isRank ? '#c8f55a' : 'transparent',
          color: isRank ? '#0e0e0e' : '#555',
        }}
      >
        {labelRank}
      </Link>
    </div>
  )
}
