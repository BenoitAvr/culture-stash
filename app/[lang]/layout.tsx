import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, LOCALES } from '@/dictionaries'
import { Nav } from '@/app/components/Nav'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const isFr = lang === 'fr'
  return {
    title: isFr ? 'Classe et explore ta culture' : 'Rank and explore culture',
    description: isFr
      ? 'Apprends, classe et organise ta culture. Films, musique, livres et plus — avec la communauté.'
      : 'Learn, rank and organize your culture. Movies, music, books and more — with the community.',
    alternates: {
      canonical: `/${lang}`,
      languages: { fr: '/fr', en: '/en' },
    },
  }
}

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
