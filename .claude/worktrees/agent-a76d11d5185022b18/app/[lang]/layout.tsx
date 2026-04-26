import { notFound } from 'next/navigation'
import { hasLocale, LOCALES } from '@/dictionaries'
import { Nav } from '@/app/components/Nav'

export function generateStaticParams() {
  return LOCALES.map(lang => ({ lang }))
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return (
    <>
      <Nav lang={lang} />
      <main>{children}</main>
    </>
  )
}
