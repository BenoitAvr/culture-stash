import 'server-only'
import { headers } from 'next/headers'

const RANK_HOSTS = (process.env.RANK_HOSTS ?? 'culture-rank.vercel.app')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

const MAIN_HOST = process.env.MAIN_HOST ?? 'culture-stash.vercel.app'

export async function getHost(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase()
}

export async function isRankHost(): Promise<boolean> {
  return RANK_HOSTS.includes(await getHost())
}

export function getMainHost(): string {
  return MAIN_HOST
}

export function getRankHost(): string {
  return RANK_HOSTS[0] ?? 'culture-rank.vercel.app'
}

export async function getSiteOrigin(): Promise<string> {
  const host = await getHost()
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return `${proto}://${host || MAIN_HOST}`
}
