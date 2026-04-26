import { NextRequest, NextResponse } from 'next/server'

const LOCALES = ['fr', 'en']
const DEFAULT_LOCALE = 'fr'

function getLocale(request: NextRequest): string {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value
  if (cookie && LOCALES.includes(cookie)) return cookie

  const acceptLang = request.headers.get('accept-language') ?? ''
  const preferred = acceptLang.split(',')[0].split('-')[0].toLowerCase()
  if (LOCALES.includes(preferred)) return preferred

  return DEFAULT_LOCALE
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
    request.nextUrl.pathname = `/${locale}${pathname}`
    const res = NextResponse.redirect(request.nextUrl)
    res.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    return res
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
