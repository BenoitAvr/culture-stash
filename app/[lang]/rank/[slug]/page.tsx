import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { RankTopicPage } from '@/app/rank/[slug]/RankTopicPage'
import { backfillMissingCovers } from '@/app/actions/entries'

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: { translations: { where: { lang } } },
  })
  if (!topic) return {}
  const tr = topic.translations[0]
  const title = tr?.title ?? topic.title
  const isFr = lang === 'fr'
  const description = isFr
    ? `Crée ta tier list ${title} et compare tes goûts avec la communauté.`
    : `Create your ${title} tier list and compare your taste with the community.`
  return {
    title: `${topic.emoji} ${isFr ? 'Classer' : 'Rank'} ${title}`,
    description,
    openGraph: { title: `${topic.emoji} ${title} — Tier list`, description },
    alternates: {
      canonical: `/${lang}/rank/${slug}`,
      languages: { fr: `/fr/rank/${slug}`, en: `/en/rank/${slug}` },
    },
  }
}

export default async function RankSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  getDictionary(lang)
  const session = await getSession()
  const userId = session?.userId

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      translations: { where: { lang } },
      entries: {
        orderBy: { createdAt: 'asc' },
      },
      userEntryLists: {
        where: { NOT: { type: 'BOTH' } },
        include: {
          user: { select: { id: true, name: true, username: true } },
          items: {
            include: { entry: { select: { id: true, title: true, year: true, cover: true } } },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!topic || !topic.rankable) notFound()

  const tr = topic.translations[0]
  const title = tr?.title ?? topic.title
  const badge = tr?.badge ?? topic.badge

  const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
  const TIER_SCORE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }

  const rankData: Record<string, { total: number; count: number }> = {}
  const tierData: Record<string, { totalScore: number; count: number }> = {}
  const favoriteData: Record<string, number> = {}
  const tierDistData: Record<string, Record<string, number>> = {}

  for (const list of topic.userEntryLists) {
    if (list.type !== 'TIER') continue
    const rts = (list.rankedTiers ?? '').split(',').filter(Boolean)

    for (const item of list.items) {
      if (!item.tier || TIER_SCORE[item.tier] === undefined) continue
      if (!tierData[item.entryId]) tierData[item.entryId] = { totalScore: 0, count: 0 }
      tierData[item.entryId].totalScore += TIER_SCORE[item.tier]
      tierData[item.entryId].count += 1

      if (!tierDistData[item.entryId]) tierDistData[item.entryId] = {}
      tierDistData[item.entryId][item.tier] = (tierDistData[item.entryId][item.tier] ?? 0) + 1

      if (item.position !== null && rts.includes(item.tier)) {
        if (!rankData[item.entryId]) rankData[item.entryId] = { total: 0, count: 0 }
        rankData[item.entryId].total += item.position
        rankData[item.entryId].count += 1
      }
    }

    // favorite = position 1 in the highest ranked tier for this user
    for (const tier of TIERS) {
      if (!rts.includes(tier)) continue
      const top = list.items.find(i => i.tier === tier && i.position === 1)
      if (top) { favoriteData[top.entryId] = (favoriteData[top.entryId] ?? 0) + 1; break }
    }
  }

  const rankedEntryIds = new Set([
    ...Object.keys(tierData),
    ...Object.keys(rankData),
    ...Object.keys(favoriteData),
  ])
  const rankedEntries = topic.entries.filter(e => rankedEntryIds.has(e.id))
  const coverMap = await backfillMissingCovers(rankedEntries)

  const entries = topic.entries.map(e => {
    const rd = rankData[e.id]
    const td = tierData[e.id]
    return {
      id: e.id,
      title: e.title,
      year: e.year,
      cover: (e.cover || coverMap.get(e.id)) || null,
      avgRank: rd && rd.count > 0 ? rd.total / rd.count : null,
      rankCount: rd?.count ?? 0,
      avgTierScore: td && td.count > 0 ? td.totalScore / td.count : null,
      tierCount: td?.count ?? 0,
      favoriteCount: favoriteData[e.id] ?? 0,
      tierDistribution: tierDistData[e.id] ?? {},
    }
  })

  const userEntryLists = topic.userEntryLists
    .filter(l => userId && l.user.id === userId)
    .map(l => ({
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

  return (
    <RankTopicPage
      topicSlug={slug}
      topicEmoji={topic.emoji}
      topicTitle={title}
      topicBadge={badge}
      entries={entries}
      userEntryLists={userEntryLists}
      currentUserId={userId ?? null}
      isLoggedIn={!!session}
    />
  )
}
