import type { Metadata } from 'next'
import { cache } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import {
  getRankTopicHeader,
  getRankTopicStats,
  getCommunityEntriesForGenre,
  getGenreCounts,
} from '@/lib/communityRankData'
import { getRankHost } from '@/lib/host'
import {
  RankCommunityBody,
  CommunityListSkeleton,
  RankSortProvider,
  MentionLegend,
  type PersonalRankData,
} from '@/app/rank/[slug]/RankTopicPage'
import { PersonalActions } from '@/app/rank/[slug]/PersonalActions'
import { GenreChipRow } from '@/app/rank/[slug]/GenreChipRow'
import type { UserEntryListData } from '@/app/rank/[slug]/UserEntryListSection'
import { genreBySlug, genreLabel } from '@/lib/genres'

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string; genre: string }>
}): Promise<Metadata> {
  const { lang, slug, genre } = await params
  const [header, g] = await Promise.all([getRankTopicHeader(slug, lang), genreBySlug(genre)])
  if (!header || !g) return {}
  const label = genreLabel(g, lang)
  const isFr = lang === 'fr'
  const description = isFr
    ? `Classement ${header.topicTitle.toLowerCase()} filtré par ${label} — mentions et rangs recalculés sur ce genre.`
    : `${header.topicTitle} ranking filtered by ${label} — mentions and ranks recomputed on this genre.`
  return {
    metadataBase: new URL(`https://${getRankHost()}`),
    title: `${header.topicEmoji} ${isFr ? 'Classer' : 'Rank'} ${header.topicTitle} — ${label}`,
    description,
    openGraph: { title: `${header.topicEmoji} ${header.topicTitle} — ${label}`, description },
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
  genreId,
}: {
  topicId: string
  topicSlug: string
  slug: string
  lang: string
  genreId: number
}) {
  const entriesPromise = getCommunityEntriesForGenre(slug, lang, genreId)
  const personalDataPromise = getPersonalRankData(topicId)

  return (
    <RankCommunityBody
      topicSlug={topicSlug}
      entriesPromise={entriesPromise}
      personalDataPromise={personalDataPromise}
      genreId={genreId}
    />
  )
}

async function RankGenreInner({
  params,
}: {
  params: Promise<{ lang: string; slug: string; genre: string }>
}) {
  const { lang, slug, genre } = await params
  if (!hasLocale(lang)) notFound()
  const g = genreBySlug(genre)
  if (!g) notFound()

  const [header, stats, genreCounts] = await Promise.all([
    getRankTopicHeader(slug, lang),
    getRankTopicStats(slug),
    getGenreCounts(slug),
  ])
  if (!header) notFound()

  const dict = getDictionary(lang)
  const isFr = lang === 'fr'
  const label = genreLabel(g, lang)
  const voteCount = stats?.voteCount ?? 0

  return (
    <div className="page-md" style={{ margin: '0 auto', padding: '24px 24px 60px' }}>
      <RankSortProvider>

      {/* Breadcrumb + personal actions */}
      <div style={{ padding: '8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 13, color: 'var(--fg-5)' }}>
            <Link href={`/${lang}/rank`} style={{ color: 'var(--fg-5)', textDecoration: 'none' }}>
              {isFr ? 'Classer' : 'Rank'}
            </Link>
            <span style={{ color: 'var(--fg-7)' }}>/</span>
            <Link href={`/${lang}/rank/${slug}`} style={{ color: 'var(--fg-5)', textDecoration: 'none' }}>
              {header.topicBadge}
            </Link>
            <span style={{ color: 'var(--fg-7)' }}>/</span>
            <span>{label}</span>
          </div>

          <Suspense fallback={<div style={{ width: 320, height: 42, borderRadius: 9, background: 'var(--bg-subtle)' }} />}>
            <PersonalActionsWrapper topicId={header.topicId} topicSlug={slug} topicTitle={header.topicTitle} topicEmoji={header.topicEmoji} lang={lang} dict={dict} />
          </Suspense>
        </div>

        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 42, fontWeight: 900, color: 'var(--fg)', letterSpacing: -0.8, lineHeight: 1.05, marginBottom: 10 }}>
          {isFr
            ? `Le top ${label.toLowerCase()} des ${header.topicTitle.toLowerCase()}`
            : `Top ${label} ${header.topicTitle.toLowerCase()}`}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 14, color: 'var(--fg-5)', marginBottom: 24 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 12,
            background: 'var(--accent-faint)',
            color: 'var(--accent-fg)',
            border: '1px solid var(--accent-muted)',
            fontSize: 12.5, fontWeight: 600,
          }}>
            {label}
          </span>
          <Link
            href={`/${lang}/rank/${slug}`}
            style={{ fontSize: 12.5, color: 'var(--fg-5)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
          >
            {isFr ? '← Voir tous les genres' : '← All genres'}
          </Link>
          {voteCount > 0 && (
            <>
              <span style={{ color: 'var(--fg-7)' }}>·</span>
              <span style={{ fontStyle: 'italic', color: 'var(--fg-6)' }}>
                {isFr
                  ? 'rangs et score recalculés sur ce genre'
                  : 'ranks and score recomputed on this genre'}
              </span>
            </>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <MentionLegend lang={lang as 'fr' | 'en'} />
          </span>
        </div>
      </div>

      {genreCounts && genreCounts.length > 0 && (
        <GenreChipRow genres={genreCounts} slug={slug} lang={lang} activeGenreId={g.id} />
      )}

      <div style={{ paddingTop: 16 }}>
        <Suspense fallback={<CommunityListSkeleton />}>
          <CommunityBody
            topicId={header.topicId}
            topicSlug={slug}
            slug={slug}
            lang={lang}
            genreId={g.id}
          />
        </Suspense>
      </div>

      </RankSortProvider>
    </div>
  )
}

export default function RankGenrePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; genre: string }>
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <RankGenreInner params={params} />
    </Suspense>
  )
}
