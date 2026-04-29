'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function LangSwitcher({ lang }: { lang: string }) {
  const pathname = usePathname()
  const otherLang = lang === 'fr' ? 'en' : 'fr'
  const otherPath = '/' + otherLang + pathname.slice(lang.length + 1)

  return (
    <Link
      href={otherPath}
      style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--fg-5)', fontSize: 12, textDecoration: 'none', fontWeight: 600, letterSpacing: '.04em' }}
    >
      {lang.toUpperCase()}
    </Link>
  )
}
