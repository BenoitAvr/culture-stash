'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { getDict } from '@/dictionaries/client'
import Link from 'next/link'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const { lang } = useParams() as { lang: string }
  const t = getDict(lang).auth
  const [state, action, pending] = useActionState(login, null)

  return (
    <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Link href={`/${lang}`} style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, textDecoration: 'none', color: 'var(--fg)' }}>
          Culture <span style={{ color: 'var(--accent-fg)' }}>Stash</span>
        </Link>
        <p style={{ color: 'var(--fg-6)', fontSize: 14, marginTop: 8 }}>{t.loginTitle}</p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 28 }}>
        {state?.error && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.emailLabel}</label>
            <input name="email" type="email" required placeholder="you@example.com" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.passwordLabel}</label>
            <input name="password" type="password" required placeholder="••••••••" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <button type="submit" disabled={pending} style={{ padding: '11px 16px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1, marginTop: 4 }}>
            {pending ? '...' : t.loginBtn}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--fg-7)', fontSize: 12 }}>{t.or}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <a href={`/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 14, textDecoration: 'none', fontFamily: 'inherit', fontWeight: 500 }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {t.loginGoogle}
        </a>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--fg-6)' }}>
          {t.noAccount}{' '}
          <Link href={`/${lang}/auth/signup`} style={{ color: 'var(--accent-fg)', textDecoration: 'none' }}>{t.signupLink}</Link>
        </p>
      </div>
    </div>
  )
}
