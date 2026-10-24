import type { Metadata } from 'next'
import { cache } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale, LOCALES } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { getRankTopicHeader, getRankTopicStats, getCommunityEntries, getGenreCounts, getRankableTopicsForTabs } from '@/lib/communityRankData'
import { getRankHost } from '@/lib/host'
import {
  RankCommunityBody,
  CommunityListSkeleton,
  RankSortProvider,
  type PersonalRankData,
} from '@/app/rank/[slug]/RankTopicPage'
import { StartTierListCTA } from '@/app/rank/[slug]/StartTierListCTA'
import type { UserEntryListData } from '@/app/rank/[slug]/UserEntryListSection'

async function getUserList(topicId: string, userId: string): Promise<UserEntryListData[]> {
  const lists = await prisma.userEntryList.findMany({
    where: { topicId, userId, NOT: { type: 'BOTH' } },
    include: {
      user: { select: { id: true, name: true, username: true } },
      items: {
        include: { entry: { select: { id: true, title: true, titleEn: true, year: true, cover: true } } },
        orderBy: { position: 'asc' },
      },
    },
  })
  return lists.map(l => ({
    id: l.id,
    userId: l.user.id,
    userName: l.user.name,
    username: l.user.username ?? l.user.id,
    type: l.type as 'RANKED' | 'TIER' | 'BOTH',
    rankedTiers: l.rankedTiers,
    items: l.items.map(i => ({
      entryId: i.entryId,
      position: i.position,
      tier: i.tier,
      note: i.note,
      entry: i.entry,
    })),
  }))
}

const getPersonalRankData = cache(async (topicId: string): Promise<PersonalRankData> => {
  const session = await getSession()
  const userLists = session ? await getUserList(topicId, session.userId) : []

  return {
    userLists,
    currentUserId: session?.userId ?? null,
    isLoggedIn: !!session,
  }
})

export async function generateStaticParams() {
  const topics = await prisma.topic.findMany({
    where: { rankable: true },
    select: { slug: true },
  })
  return LOCALES.flatMap(lang => topics.map(t => ({ lang, slug: t.slug })))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  const header = await getRankTopicHeader(slug, lang)
  if (!header) return {}
  const isFr = lang === 'fr'
  const description = isFr
    ? `Crée ta tier list ${header.topicTitle} et compare tes goûts avec la communauté.`
    : `Create your ${header.topicTitle} tier list and compare your taste with the community.`
  return {
    metadataBase: new URL(`https://${getRankHost()}`),
    title: `${header.topicEmoji} ${isFr ? 'Classer' : 'Rank'} ${header.topicTitle}`,
    description,
    openGraph: { title: `${header.topicEmoji} ${header.topicTitle} — Tier list`, description },
    alternates: {
      canonical: `/${lang}/${slug}`,
      languages: { fr: `/fr/${slug}`, en: `/en/${slug}` },
    },
  }
}

function StartTierListCTAWrapper({
  lang,
  topicId,
  topicSlug,
}: {
  lang: string
  topicId: string
  topicSlug: string
}) {
  const personalDataPromise = getPersonalRankData(topicId)
  return (
    <StartTierListCTA lang={lang} topicSlug={topicSlug} personalDataPromise={personalDataPromise} />
  )
}

function CommunityBody({
  topicId,
  topicSlug,
  slug,
  lang,
  userCount,
  voteCount,
  genreCounts,
}: {
  topicId: string
  topicSlug: string
  slug: string
  lang: string
  userCount: number
  voteCount: number
  genreCounts: Array<{ id: number; count: number }>
}) {
  const entriesPromise = getCommunityEntries(slug, lang)
  const personalDataPromise = getPersonalRankData(topicId)

  return (
    <RankCommunityBody
      topicSlug={topicSlug}
      entriesPromise={entriesPromise}
      personalDataPromise={personalDataPromise}
      userCount={userCount}
      voteCount={voteCount}
      genreCounts={genreCounts}
    />
  )
}

async function RankSlugInner({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const [header, stats, genreCounts, topicTabs] = await Promise.all([
    getRankTopicHeader(slug, lang),
    getRankTopicStats(slug),
    getGenreCounts(slug),
    getRankableTopicsForTabs(lang),
  ])
  if (!header) notFound()

  const dict = getDictionary(lang)
  const userCount = stats?.userCount ?? 0
  const voteCount = stats?.voteCount ?? 0
  const isFr = lang === 'fr'

  return (
    <div className="page-md" style={{ margin: '0 auto', padding: '24px 24px 60px' }}>
      <RankSortProvider>

      {/* Header */}
      <div style={{ padding: '8px 0 0' }}>
        {/* Topic tabs — the primary navigation now that /rank/ redirects
            straight here. Active tab = this page's topic. "Bientôt" tabs
            are placeholders for topics not yet rankable; they'll turn into
            real tabs automatically once their slug is live. */}
        <div
          role="tablist"
          aria-label={isFr ? 'Catégorie de classement' : 'Ranking category'}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            marginBottom: 22,
          }}
        >
          {topicTabs.map(tab => {
            const isActive = tab.slug === slug
            return (
              <Link
                key={tab.slug}
                href={`/${lang}/rank/${tab.slug}`}
                role="tab"
                aria-selected={isActive}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 16px', borderRadius: 999,
                  background: isActive ? 'var(--accent-faint)' : 'var(--bg-card)',
                  border: `1.5px solid ${isActive ? 'var(--accent-fg)' : 'var(--border)'}`,
                  color: isActive ? 'var(--accent-fg)' : 'var(--fg-3)',
                  fontSize: 14, fontWeight: isActive ? 800 : 600, textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 4px 12px rgba(22,163,74,.12)' : undefined,
                  transition: 'transform .12s, border-color .12s, background .12s',
                }}
                className={isActive ? '' : 'hover:[border-color:var(--accent-muted)] hover:[transform:translateY(-1px)]'}
              >
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>{tab.emoji}</span>
                {tab.title}
              </Link>
            )
          })}
        </div>

        {/* Hero — the hook is the main H1 since this is the landing page.
            One green CTA below acts as both "start a list" (newcomers) and
            "my list" (returners); no top-right duplicate needed. */}
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 46, fontWeight: 800, fontStyle: 'italic',
          color: 'var(--fg)', letterSpacing: -1, lineHeight: 1.05,
          margin: '0 0 14px', maxWidth: 760,
        }}>
            {isFr ? 'Et si on classait autrement ?' : 'What if we ranked differently?'}
        </h1>

        <p style={{
          fontSize: 16, lineHeight: 1.55, color: 'var(--fg-3)',
          margin: '0 0 20px', maxWidth: 720,
        }}>
          {isFr
            ? <>Classe tes œuvres préférées, et découvre ce que la communauté aime vraiment, selon la place qu&apos;elles occupent dans les classements de chacun.</>
            : <>Rank your favourite works, and discover what the community truly loves — based on where they sit in each person&apos;s rankings.</>}
        </p>

        {/* Primary CTA — same green button for everyone; label + destination
            swap between "Faire ma tier list" (newcomers → /edit) and "Ma
            liste" (returners → /<username>/edit) so the primary action never
            moves on screen. */}
        <div style={{ marginBottom: 36 }}>
          <Suspense fallback={<div style={{ height: 48 }} />}>
            <StartTierListCTAWrapper lang={lang} topicId={header.topicId} topicSlug={slug} />
          </Suspense>
        </div>

        {/* Section header for the ranking table — demoted from H1 since the
            hook now owns that slot. */}
        <h2 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 26, fontWeight: 800,
          color: 'var(--fg-2)', letterSpacing: -0.4, lineHeight: 1.15,
          margin: '0 0 2px',
        }}>
          {dict.rank.communityTitle.replace('{topic}', header.topicTitle.toLowerCase())}
        </h2>
      </div>

      {/* Community body — suspended (creates personalDataPromise inside) */}
      <div style={{ paddingTop: 16 }}>
        <Suspense fallback={<CommunityListSkeleton />}>
          <CommunityBody
            topicId={header.topicId}
            topicSlug={slug}
            slug={slug}
            lang={lang}
            userCount={userCount}
            voteCount={voteCount}
            genreCounts={genreCounts ?? []}
          />
        </Suspense>
      </div>

      {/* Comment ça marche — collapsed by default, native <details> so it
          works without JS. For the curious; everyone else got the ranking. */}
      <details style={{
        marginTop: 40,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 18px',
      }}>
        <summary style={{
          cursor: 'pointer',
          fontFamily: "'Fraunces', serif",
          fontSize: 15, fontWeight: 800,
          color: 'var(--fg-2)',
          letterSpacing: -0.3,
          listStyle: 'revert',
        }}>
          {isFr ? 'Comment ça marche ?' : 'How does it work?'}
        </summary>
        <div style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}>
          {[
            isFr
              ? { emoji: '🎬', title: 'Choisis un film', desc: 'de la liste — ou ajoute-en un qui manque.' }
              : { emoji: '🎬', title: 'Pick a film', desc: 'from the list — or add one that’s missing.' },
            isFr
              ? { emoji: '🏷️', title: 'Donne-lui une mention', desc: 'de Excellent à Mauvais, à ta sauce.' }
              : { emoji: '🏷️', title: 'Give it a mention', desc: 'from Excellent to Bad, your call.' },
            isFr
              ? { emoji: '📊', title: 'Classe-les entre eux', desc: 'dans chaque mention. Ton rang personnel pèse dans le classement global.' }
              : { emoji: '📊', title: 'Rank them against each other', desc: 'within each mention. Your personal rank feeds the global ranking.' },
          ].map((step, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                padding: '14px 14px 12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <span aria-hidden style={{
                position: 'absolute', top: 8, right: 10,
                fontFamily: "'Fraunces', serif",
                fontSize: 28, fontWeight: 900, lineHeight: 1,
                color: 'var(--accent-fg)', opacity: 0.12,
              }}>
                {i + 1}
              </span>
              <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{step.emoji}</span>
              <span style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 14, fontWeight: 800, color: 'var(--fg)',
                letterSpacing: -0.2, lineHeight: 1.25,
              }}>
                {step.title}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--fg-4)', lineHeight: 1.5 }}>
                {step.desc}
              </span>
            </div>
          ))}
        </div>
      </details>

      </RankSortProvider>
    </div>
  )
}

export default function RankSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <RankSlugInner params={params} />
    </Suspense>
  )
}
