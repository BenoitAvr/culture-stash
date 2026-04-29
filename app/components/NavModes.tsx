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
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-subtle)', borderRadius: 9, padding: 3, border: '1px solid var(--border)' }}>
      <Link
        href={`/${lang}`}
        style={{
          ...base,
          background: !isRank ? 'var(--border)' : 'transparent',
          color: !isRank ? 'var(--fg)' : 'var(--fg-3)',
        }}
      >
        {labelLearn}
      </Link>
      <Link
        href={`/${lang}/rank`}
        style={{
          ...base,
          background: isRank ? 'var(--btn)' : 'transparent',
          color: isRank ? 'var(--btn-text)' : 'var(--fg-3)',
        }}
      >
        {labelRank}
      </Link>
    </div>
  )
}
