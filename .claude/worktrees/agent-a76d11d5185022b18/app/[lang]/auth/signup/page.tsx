import { SignupForm } from '@/app/auth/signup/SignupForm'

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <SignupForm />
    </div>
  )
}
