import { redirect } from 'next/navigation'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  if (!clientId) {
    redirect('/auth/login?error=google_not_configured')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  })

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
