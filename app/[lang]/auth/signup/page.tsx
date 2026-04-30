import { SignupForm } from '@/app/auth/signup/SignupForm'
import { Suspense } from 'react'

function AuthPageFallback() {
  return (
    <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
      <div style={{ height: 34, width: 220, margin: '0 auto 40px', borderRadius: 8, background: 'var(--bg-subtle)' }} />
      <div style={{ height: 390, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
    </div>
  )
}

async function SignupPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ redirect?: string }>
}) {
  const { lang } = await params
  const { redirect } = await searchParams
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <SignupForm redirectTo={redirect || `/${lang}/rank`} />
    </div>
  )
}

export default function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ redirect?: string }>
}) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <AuthPageFallback />
      </div>
    }>
      <SignupPageContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
