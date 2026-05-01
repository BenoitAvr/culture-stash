import { NextRequest, NextResponse } from 'next/server'

const LOCALES = ['fr', 'en']
const DEFAULT_LOCALE = 'fr'

const RANK_HOSTS = (process.env.RANK_HOSTS ?? 'culture-rank.vercel.app')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

const MAIN_HOST = process.env.MAIN_HOST ?? 'culture-stash.vercel.app'

function getLocale(request: NextRequest): string {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value
  if (cookie && LOCALES.includes(cookie)) return cookie

  const acceptLang = request.headers.get('accept-language') ?? ''
  const preferred = acceptLang.split(',')[0].split('-')[0].toLowerCase()
  if (LOCALES.includes(preferred)) return preferred

  return DEFAULT_LOCALE
}

function applyRankHostRouting(
  request: NextRequest,
  lang: string,
  rest: string,
  search: string,
): NextResponse | null {
  if (rest.startsWith('/rank')) {
    // Only cloak GET requests. POSTs (Server Actions) must reach the real
    // /rank/* route, otherwise a 301 turns into a GET and drops form data.
    if (request.method !== 'GET') return null
    const clean = rest === '/rank' ? '' : rest.slice('/rank'.length)
    return NextResponse.redirect(new URL(`/${lang}${clean}${search}`, request.url), 301)
  }

  if (rest.startsWith('/auth')) {
    return null
  }

  if (rest.startsWith('/topics') || rest === '/search' || rest.startsWith('/search/')) {
    const dest = new URL(`/${lang}${rest}${search}`, request.url)
    dest.host = MAIN_HOST
    dest.protocol = 'https:'
    return NextResponse.redirect(dest, 301)
  }

  return NextResponse.rewrite(new URL(`/${lang}/rank${rest}${search}`, request.url))
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) return NextResponse.next()

  const detectedLocale = LOCALES.find(
    l => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  )

  if (!detectedLocale) {
    const locale = getLocale(request)
    // Avoid producing '/fr/' (trailing slash) when pathname is '/'.
    request.nextUrl.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    const res = NextResponse.redirect(request.nextUrl)
    res.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    return res
  }

  const host = (request.headers.get('host') ?? '').toLowerCase()
  const isRankHost = RANK_HOSTS.includes(host)

  if (isRankHost) {
    const rest = pathname.slice(`/${detectedLocale}`.length)
    const rankResponse = applyRankHostRouting(request, detectedLocale, rest, search)
    if (rankResponse) {
      rankResponse.cookies.set('NEXT_LOCALE', detectedLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
      return rankResponse
    }
  }

  const res = NextResponse.next({
    request: {
      headers: new Headers({ ...Object.fromEntries(request.headers), 'x-locale': detectedLocale }),
    },
  })
  res.cookies.set('NEXT_LOCALE', detectedLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
