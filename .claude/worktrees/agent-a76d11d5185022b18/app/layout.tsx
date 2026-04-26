import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Totantia',
  description: 'Apprends, classe et organise tes connaissances.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const lang = h.get('x-locale') ?? 'fr'

  return (
    <html lang={lang}>
      <body suppressHydrationWarning className="min-h-screen" style={{ background: '#0e0e0e', color: '#f0f0f0', fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
