import Link from 'next/link'
import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { logout } from '@/app/actions/auth'
import { NavSearch } from './NavSearch'
import { LangSwitcher } from './LangSwitcher'
import { NavModes } from './NavModes'

export async function Nav({ lang }: { lang: string }) {
  const session = await getSession()
  const t = hasLocale(lang) ? getDictionary(lang) : getDictionary('fr')

  return (
    <nav style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 28px', borderBottom: '1px solid #2a2a2a',
      position: 'sticky', top: 0, background: 'rgba(14,14,14,0.96)',
      backdropFilter: 'blur(8px)', zIndex: 100,
    }}>
      <div style={{ flex: 1 }}>
        <Link href={`/${lang}`} style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, textDecoration: 'none', color: '#f0f0f0' }}>
          Tot<span style={{ color: '#c8f55a' }}>an</span>tia
        </Link>
      </div>

      <Suspense fallback={<div style={{ width: 220 }} />}>
        <NavSearch lang={lang} placeholder={t.search.placeholder} />
      </Suspense>

      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        <NavModes lang={lang} labelLearn={t.nav.explore} labelRank={t.nav.rank} />
        <LangSwitcher lang={lang} />
        {session ? (
          <>
            <Link href={`/${lang}/topics/new`} style={{ padding: '7px 14px', borderRadius: 7, background: '#c8f55a', color: '#0e0e0e', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              {t.nav.contribute}
            </Link>
            <form action={logout} style={{ display: 'inline' }}>
              <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #2a2a2a', background: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {session.name.split(' ')[0]}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href={`/${lang}/auth/login`} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #2a2a2a', color: '#777', fontSize: 13, textDecoration: 'none' }}>
              {t.nav.login}
            </Link>
            <Link href={`/${lang}/auth/signup`} style={{ padding: '7px 14px', borderRadius: 7, background: '#c8f55a', color: '#0e0e0e', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              {t.nav.contribute}
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
