import { LoginForm } from '@/app/auth/login/LoginForm'

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <LoginForm />
    </div>
  )
}
