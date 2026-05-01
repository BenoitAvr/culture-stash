import 'server-only'
import type { NextRequest } from 'next/server'

const RANK_HOSTS = (process.env.RANK_HOSTS ?? 'culture-rank.vercel.app')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

export function getOAuthConfig(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase()
  const isRank = RANK_HOSTS.includes(host)
  const proto = host.startsWith('localhost') ? 'http' : 'https'

  return {
    clientId: isRank ? process.env.GOOGLE_CLIENT_ID_RANK : process.env.GOOGLE_CLIENT_ID,
    clientSecret: isRank ? process.env.GOOGLE_CLIENT_SECRET_RANK : process.env.GOOGLE_CLIENT_SECRET,
    appUrl: host ? `${proto}://${host}` : (process.env.APP_URL ?? 'http://localhost:3000'),
  }
}
