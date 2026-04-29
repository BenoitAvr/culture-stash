import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://culturestash.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Culture Stash',
    template: '%s — Culture Stash',
  },
  description: 'Apprends, classe et organise tes connaissances culturelles.',
  openGraph: {
    siteName: 'Culture Stash',
    type: 'website',
  },
  twitter: {
    card: 'summary',
  },
  robots: { index: true, follow: true },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const lang = h.get('x-locale') ?? 'fr'

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var t = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
` }} />
      </head>
      <body suppressHydrationWarning className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
