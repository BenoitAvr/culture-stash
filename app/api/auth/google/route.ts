import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=google_not_configured`)
  }

  const redirectTo = req.nextUrl.searchParams.get('redirect') || '/fr/rank'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  })

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  res.cookies.set('auth_redirect', redirectTo, { httpOnly: true, maxAge: 300, path: '/' })
  return res
}
