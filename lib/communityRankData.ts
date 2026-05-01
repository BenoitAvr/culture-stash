import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_SCORE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }
const INITIAL_COUNT = 100

export type RankEntry = {
  id: string
  title: string
  titleEn: string | null
  year: number | null
  cover: string | null
  avgRank: number | null
  rankCount: number
  avgTierScore: number | null
  tierCount: number
  favoriteCount: number
  tierDistribution: Record<string, number>
}

export type RankTopicHeader = {
  topicId: string
  topicEmoji: string
  topicTitle: string
  topicBadge: string
}

export type CommunityEntries = {
  initialEntries: RankEntry[]
  totalEntries: number
}

export type CommunityData = RankTopicHeader & {
  entries: RankEntry[]
}

function combinedScore(e: RankEntry) {
  return (e.avgTierScore ?? 0) * 4 + (e.avgRank ? 1 / e.avgRank * 12 : 0) + e.favoriteCount + e.tierCount * 0.2
}

export function getRankTopicHeader(slug: string, lang: string): Promise<RankTopicHeader | null> {
  return unstable_cache(
    async () => {
      const topic = await prisma.topic.findUnique({
        where: { slug },
        include: { translations: { where: { lang } } },
      })
      if (!topic || !topic.rankable) return null

      const tr = topic.translations[0]
      return {
        topicId: topic.id,
        topicEmoji: topic.emoji,
        topicTitle: tr?.title ?? topic.title,
        topicBadge: tr?.badge ?? topic.badge,
      }
    },
    [`rank-header-${slug}-${lang}`],
    { tags: [`rank-${slug}`] }
  )()
}

export function getCommunityData(slug: string, lang: string): Promise<CommunityData | null> {
  return unstable_cache(
    async () => {
      const topic = await prisma.topic.findUnique({
        where: { slug },
        include: {
          translations: { where: { lang } },
          entries: { orderBy: { createdAt: 'asc' } },
          userEntryLists: {
            where: { NOT: { type: 'BOTH' } },
            select: {
              type: true,
              rankedTiers: true,
              items: {
                select: { entryId: true, tier: true, position: true },
              },
            },
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
            titleEn: e.titleEn,
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

export async function getCommunityEntries(slug: string, lang: string): Promise<CommunityEntries | null> {
  const data = await getCommunityData(slug, lang)
  if (!data) return null

  const sorted = [...data.entries].sort((a, b) => combinedScore(b) - combinedScore(a))
  return {
    initialEntries: sorted.slice(0, INITIAL_COUNT),
    totalEntries: sorted.length,
  }
}
