import Link from 'next/link'
import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { logout } from '@/app/actions/auth'
import { NavSearch } from './NavSearch'
import { LangSwitcher } from './LangSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { NavLoginLink } from './NavLoginLink'

type NavDict = ReturnType<typeof getDictionary>['nav']

async function NavAuth({ lang, nav }: { lang: string; nav: NavDict }) {
  const session = await getSession()
  return session ? (
    <>
      <Link href={`/${lang}/topics/new`} style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
        {nav.contribute}
      </Link>
      <form action={logout} style={{ display: 'inline' }}>
        <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          {session.name.split(' ')[0]}
        </button>
      </form>
    </>
  ) : (
    <>
      <NavLoginLink lang={lang} label={nav.login} />
      <Link href={`/${lang}/auth/signup`} style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
        {nav.contribute}
      </Link>
    </>
  )
}

export function Nav({ lang }: { lang: string }) {
  const t = hasLocale(lang) ? getDictionary(lang) : getDictionary('fr')

  return (
    <nav style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 28px', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, background: 'var(--bg-nav)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 1px 0 var(--border)', zIndex: 100,
    }}>
      <div style={{ flex: 1 }}>
        <Link href={`/${lang}`} style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, textDecoration: 'none', color: 'var(--fg)' }}>
          Culture <span style={{ color: 'var(--accent-fg)' }}>Stash</span>
        </Link>
      </div>

      <Suspense fallback={<div style={{ width: 220 }} />}>
        <NavSearch lang={lang} placeholder={t.search.placeholder} />
      </Suspense>

      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        <ThemeToggle />
        <Suspense fallback={<div style={{ width: 44 }} />}>
          <LangSwitcher lang={lang} />
        </Suspense>
        <Suspense fallback={<div style={{ width: 180 }} />}>
          <NavAuth lang={lang} nav={t.nav} />
        </Suspense>
      </div>
    </nav>
  )
}
