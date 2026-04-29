import { SignupForm } from '@/app/auth/signup/SignupForm'

export default async function SignupPage({
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
