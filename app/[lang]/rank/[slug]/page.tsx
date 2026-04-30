import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { RankTopicPage } from '@/app/rank/[slug]/RankTopicPage'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_SCORE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }

function getCommunityData(slug: string, lang: string) {
  return unstable_cache(
    async () => {
      const topic = await prisma.topic.findUnique({
        where: { slug },
        include: {
          translations: { where: { lang } },
          entries: { orderBy: { createdAt: 'asc' } },
          userEntryLists: {
            where: { NOT: { type: 'BOTH' } },
            include: {
              items: {
                include: { entry: { select: { id: true, title: true, year: true, cover: true } } },
                orderBy: { position: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      if (!topic || !topic.rankable) return null

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
        for (const tier of TIERS) {
          if (!rts.includes(tier)) continue
          const top = list.items.find(i => i.tier === tier && i.position === 1)
          if (top) { favoriteData[top.entryId] = (favoriteData[top.entryId] ?? 0) + 1; break }
        }
      }

      const tr = topic.translations[0]
      return {
        topicId: topic.id,
        topicEmoji: topic.emoji,
        topicTitle: tr?.title ?? topic.title,
        topicBadge: tr?.badge ?? topic.badge,
        entries: topic.entries.map(e => {
          const rd = rankData[e.id]
          const td = tierData[e.id]
          return {
            id: e.id,
            title: e.title,
            year: e.year,
            cover: e.cover || null,
            avgRank: rd && rd.count > 0 ? rd.total / rd.count : null,
            rankCount: rd?.count ?? 0,
            avgTierScore: td && td.count > 0 ? td.totalScore / td.count : null,
            tierCount: td?.count ?? 0,
            favoriteCount: favoriteData[e.id] ?? 0,
            tierDistribution: tierDistData[e.id] ?? {},
          }
        }),
      }
    },
    [`rank-community-${slug}-${lang}`],
    { tags: [`rank-${slug}`] }
  )()
}

async function getUserList(topicId: string, userId: string) {
  const lists = await prisma.userEntryList.findMany({
    where: { topicId, userId, NOT: { type: 'BOTH' } },
    include: {
      user: { select: { id: true, name: true, username: true } },
      items: {
        include: { entry: { select: { id: true, title: true, year: true, cover: true } } },
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

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  const data = await getCommunityData(slug, lang)
  if (!data) return {}
  const isFr = lang === 'fr'
  const description = isFr
    ? `Crée ta tier list ${data.topicTitle} et compare tes goûts avec la communauté.`
    : `Create your ${data.topicTitle} tier list and compare your taste with the community.`
  return {
    title: `${data.topicEmoji} ${isFr ? 'Classer' : 'Rank'} ${data.topicTitle}`,
    description,
    openGraph: { title: `${data.topicEmoji} ${data.topicTitle} — Tier list`, description },
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

  const data = await getCommunityData(slug, lang)
  if (!data) notFound()

  const myLists = session
    ? await getUserList(data.topicId, session.userId)
    : []

  return (
    <RankTopicPage
      topicSlug={slug}
      topicEmoji={data.topicEmoji}
      topicTitle={data.topicTitle}
      topicBadge={data.topicBadge}
      entries={data.entries}
      userEntryLists={myLists}
      currentUserId={session?.userId ?? null}
      isLoggedIn={!!session}
    />
  )
}
