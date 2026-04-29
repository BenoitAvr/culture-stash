import { LoginForm } from '@/app/auth/login/LoginForm'

export default async function LoginPage({
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
      <LoginForm redirectTo={redirect || `/${lang}/rank`} />
    </div>
  )
}
