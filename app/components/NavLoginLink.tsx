'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLoginLink({ lang, label }: { lang: string; label: string }) {
  const pathname = usePathname()
  return (
    <Link
      href={`/${lang}/auth/login?redirect=${encodeURIComponent(pathname)}`}
      style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--fg-5)', fontSize: 13, textDecoration: 'none' }}
    >
      {label}
    </Link>
  )
}
