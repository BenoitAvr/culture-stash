import type { Metadata } from 'next'
import { cache } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale, LOCALES } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { getRankTopicHeader, getRankTopicStats, getCommunityEntries } from '@/lib/communityRankData'
import { getRankHost } from '@/lib/host'
import {
  RankCommunityBody,
  CommunityListSkeleton,
  RankSortProvider,
  MentionLegend,
  type PersonalRankData,
} from '@/app/rank/[slug]/RankTopicPage'
import { PersonalActions } from '@/app/rank/[slug]/PersonalActions'
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

type Dict = ReturnType<typeof getDictionary>

function PersonalActionsWrapper({
  topicId,
  topicSlug,
  topicTitle,
  topicEmoji,
  lang,
  dict,
}: {
  topicId: string
  topicSlug: string
  topicTitle: string
  topicEmoji: string
  lang: string
  dict: Dict
}) {
  const personalDataPromise = getPersonalRankData(topicId)
  return (
    <PersonalActions
      topicSlug={topicSlug}
      topicTitle={topicTitle}
      topicEmoji={topicEmoji}
      lang={lang}
      personalDataPromise={personalDataPromise}
      labels={{
        create: dict.rankings.createList,
        edit: dict.rankings.editList,
        login: dict.rank.loginToRate,
        share: dict.rank.share,
        copyList: dict.rank.copyList,
        import: dict.rank.import,
        shareCopied: dict.rank.shareCopied,
        listCopied: dict.rank.listCopied,
        importInvalid: dict.rank.importInvalid,
        importTitle: dict.rank.importTitle,
        importHelp: dict.rank.importHelp,
        importFormatHint: dict.rank.importFormatHint,
        importPlaceholder: dict.rank.importPlaceholder,
        importSubmit: dict.rank.importSubmit,
        importCancel: dict.rank.importCancel,
      }}
    />
  )
}

function CommunityBody({
  topicId,
  topicSlug,
  slug,
  lang,
}: {
  topicId: string
  topicSlug: string
  slug: string
  lang: string
}) {
  const entriesPromise = getCommunityEntries(slug, lang)
  const personalDataPromise = getPersonalRankData(topicId)

  return (
    <RankCommunityBody
      topicSlug={topicSlug}
      entriesPromise={entriesPromise}
      personalDataPromise={personalDataPromise}
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

  const [header, stats] = await Promise.all([
    getRankTopicHeader(slug, lang),
    getRankTopicStats(slug),
  ])
  if (!header) notFound()

  const dict = getDictionary(lang)
  const userCount = stats?.userCount ?? 0
  const voteCount = stats?.voteCount ?? 0
  const isFr = lang === 'fr'
  const userLabel = isFr
    ? (userCount > 1 ? 'contributeurs' : 'contributeur')
    : (userCount > 1 ? 'contributors' : 'contributor')
  const voteLabel = isFr
    ? 'avis'
    : (voteCount > 1 ? 'ratings' : 'rating')

  return (
    <div className="page-md" style={{ margin: '0 auto', padding: '24px 24px 60px' }}>
      <RankSortProvider>

      {/* Header */}
      <div style={{ padding: '8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-5)' }}>
            <Link href={`/${lang}/rank`} style={{ color: 'var(--fg-5)', textDecoration: 'none' }}>
              {lang === 'fr' ? 'Classer' : 'Rank'}
            </Link>
            <span style={{ color: 'var(--fg-7)' }}>/</span>
            <span>{header.topicBadge}</span>
          </div>

          <Suspense fallback={<div style={{ width: 320, height: 42, borderRadius: 9, background: 'var(--bg-subtle)' }} />}>
            <PersonalActionsWrapper topicId={header.topicId} topicSlug={slug} topicTitle={header.topicTitle} topicEmoji={header.topicEmoji} lang={lang} dict={dict} />
          </Suspense>
        </div>

        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 42, fontWeight: 900, color: 'var(--fg)', letterSpacing: -0.8, lineHeight: 1.05, marginBottom: 10 }}>
          {dict.rank.communityTitle.replace('{topic}', header.topicTitle.toLowerCase())}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 14, color: 'var(--fg-5)', marginBottom: 24 }}>
          {voteCount === 0 ? (
            <span style={{ fontStyle: 'italic' }}>
              {isFr ? 'En attente du premier avis · sois le premier' : 'Awaiting first ratings · be the first'}
            </span>
          ) : (
            <>
              <span style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
              }}>
                {isFr ? 'En construction' : 'Under construction'}
              </span>
              <span>{userCount} {userLabel}</span>
              <span style={{ color: 'var(--fg-7)' }}>·</span>
              <span>{voteCount} {voteLabel}</span>
            </>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <MentionLegend lang={lang as 'fr' | 'en'} />
          </span>
        </div>
      </div>

      {/* Community body — suspended (creates personalDataPromise inside) */}
      <div style={{ paddingTop: 16 }}>
        <Suspense fallback={<CommunityListSkeleton />}>
          <CommunityBody
            topicId={header.topicId}
            topicSlug={slug}
            slug={slug}
            lang={lang}
          />
        </Suspense>
      </div>

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
