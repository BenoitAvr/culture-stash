import type { Metadata } from 'next'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
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
