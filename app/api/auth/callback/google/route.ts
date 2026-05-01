import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/session'
import { generateUsername } from '@/lib/username'
import { getOAuthConfig } from '@/lib/oauth'

export async function GET(req: NextRequest) {
  const { clientId, clientSecret, appUrl } = getOAuthConfig(req)

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=google_denied`)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: `${appUrl}/api/auth/callback/google`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=google_token`)
  }

  const { access_token } = await tokenRes.json()

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=google_userinfo`)
  }

  const { id: googleId, email, name } = await userRes.json()

  let user = await prisma.user.findUnique({ where: { googleId } })
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email } })
    if (byEmail) {
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId } })
    } else {
      const username = await generateUsername(name)
      user = await prisma.user.create({ data: { googleId, email, name, username } })
    }
  }

  // Backfill username for existing users who don't have one yet
  let { username } = user
  if (!username) {
    username = await generateUsername(user.name, user.id)
    await prisma.user.update({ where: { id: user.id }, data: { username } })
  }

  await createSession({ userId: user.id, name: user.name, username, email: user.email })

  const redirectTo = req.cookies.get('auth_redirect')?.value || '/fr/rank'
  const res = NextResponse.redirect(`${appUrl}${redirectTo}`)
  res.cookies.delete('auth_redirect')
  return res
}
