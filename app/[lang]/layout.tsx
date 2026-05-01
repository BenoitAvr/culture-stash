import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { hasLocale, LOCALES, getDictionary } from '@/dictionaries'
import { Nav } from '@/app/components/Nav'
import { FeedbackWidget } from '@/app/components/FeedbackWidget'
import { isRankHost, getRankHost, getMainHost } from '@/lib/host'
import { getSession } from '@/lib/session'

async function NavWithHost({ lang }: { lang: string }) {
  const onRank = await isRankHost()
  return <Nav lang={lang} onRank={onRank} />
}

async function FeedbackWidgetWithSession({ lang }: { lang: string }) {
  const session = await getSession()
  const dict = getDictionary(lang as 'fr' | 'en')
  return <FeedbackWidget labels={dict.feedback} loggedInName={session?.name ?? null} />
}

const NAV_FALLBACK_HEIGHT = 57

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const isFr = lang === 'fr'
  const onRank = await isRankHost()

  if (onRank) {
    return {
      metadataBase: new URL(`https://${getRankHost()}`),
      title: {
        default: isFr ? 'Culture Rank — Classe et compare' : 'Culture Rank — Rank and compare',
        template: '%s — Culture Rank',
      },
      description: isFr
        ? 'Crée tes tier lists et compare tes goûts avec la communauté. Films, albums, jeux et plus.'
        : 'Create tier lists and compare your taste with the community. Movies, albums, games and more.',
      openGraph: { siteName: 'Culture Rank', type: 'website' },
      alternates: {
        canonical: `/${lang}`,
        languages: { fr: '/fr', en: '/en' },
      },
    }
  }

  return {
    metadataBase: new URL(`https://${getMainHost()}`),
    title: {
      default: isFr ? 'Classe et explore ta culture' : 'Rank and explore culture',
      template: '%s — Culture Stash',
    },
    description: isFr
      ? 'Apprends, classe et organise ta culture. Films, musique, livres et plus — avec la communauté.'
      : 'Learn, rank and organize your culture. Movies, music, books and more — with the community.',
    openGraph: { siteName: 'Culture Stash', type: 'website' },
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
      <Suspense fallback={<div style={{ height: NAV_FALLBACK_HEIGHT, borderBottom: '1px solid var(--border)' }} />}>
        <NavWithHost lang={lang} />
      </Suspense>
      <main>{children}</main>
      <Suspense fallback={null}>
        <FeedbackWidgetWithSession lang={lang} />
      </Suspense>
    </>
  )
}
