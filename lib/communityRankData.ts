import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { combinedScore } from '@/lib/communityRankScore'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_SCORE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }
const INITIAL_COUNT = 100

export type RankEntry = {
  id: string
  title: string
  titleEn: string | null
  year: number | null
  cover: string | null
  // 'FILM' or 'SAGA' — SAGA entries represent a whole franchise.
  kind: 'FILM' | 'SAGA'
  avgRank: number | null
  rankCount: number
  avgTierScore: number | null
  tierCount: number
  favoriteCount: number
  tierDistribution: Record<string, number>
  // Sorted list of individual fractional global ranks every user gave this
  // entry — used by the "N classements" popover to show the anonymised
  // distribution of positions.
  rankPositions: number[]
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

export type RankTopicStats = {
  userCount: number
  voteCount: number
}

export function getRankTopicStats(slug: string): Promise<RankTopicStats | null> {
  return unstable_cache(
    async () => {
      const topic = await prisma.topic.findUnique({
        where: { slug },
        select: {
          rankable: true,
          userEntryLists: {
            where: { type: 'TIER' },
            select: {
              userId: true,
              items: { select: { tier: true } },
            },
          },
        },
      })
      if (!topic || !topic.rankable) return null

      const userIds = new Set<string>()
      let voteCount = 0
      for (const list of topic.userEntryLists) {
        let listHasVote = false
        for (const item of list.items) {
          if (item.tier && TIER_SCORE[item.tier] !== undefined) {
            voteCount += 1
            listHasVote = true
          }
        }
        if (listHasVote) userIds.add(list.userId)
      }
      return { userCount: userIds.size, voteCount }
    },
    [`rank-stats-${slug}`],
    { tags: [`rank-${slug}`] }
  )()
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

      const rankData: Record<string, { sumLog: number; count: number }> = {}
      const tierData: Record<string, { totalScore: number; count: number }> = {}
      const favoriteData: Record<string, number> = {}
      const tierDistData: Record<string, Record<string, number>> = {}
      const rankPositionsData: Record<string, number[]> = {}

      for (const list of topic.userEntryLists) {
        if (list.type !== 'TIER') continue
        const rts = (list.rankedTiers ?? '').split(',').filter(Boolean)

        // For each tier, normalize the stored positions to a contiguous local
        // 1-based scale (preserving ties). Legacy rows may have globalized
        // positions (e.g. 5, 6, 7 for the second ranked tier) or missing
        // positions (old "vrac" tiers) — normalization harmonizes both.
        //
        // For each item we also derive:
        //   - localRank: integer rank in the tier (ties share the same number)
        //   - globalFracRank: the "official" fractional rank across the whole
        //     list, i.e. the average global position occupied by the tie group.
        type Enriched = {
          entryId: string
          tier: string
          localRank: number
          globalFracRank: number
        }
        const enriched: Enriched[] = []
        let runningGlobal = 0  // count of items in preceding tiers
        for (const tier of TIERS) {
          const inTier = list.items
            .filter(i => i.tier === tier)
            .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          if (inTier.length === 0) continue
          const isLegacyVrac = !rts.includes(tier)
          // Build local rank groups: items at the same stored position stay
          // tied; items at distinct stored positions get distinct local ranks.
          const groups: Array<{ items: typeof inTier }> = []
          if (isLegacyVrac) {
            // Legacy vrac tier → every item is tied at local rank 1.
            groups.push({ items: inTier })
          } else {
            let prevStored: number | null = null
            for (const i of inTier) {
              const stored = i.position ?? null
              if (stored !== null && stored === prevStored && groups.length > 0) {
                groups[groups.length - 1].items.push(i)
              } else {
                groups.push({ items: [i] })
              }
              prevStored = stored
            }
          }
          let posInTier = 1
          groups.forEach((g, gIdx) => {
            const localRank = gIdx + 1
            const occupied: number[] = []
            for (let i = 0; i < g.items.length; i++) occupied.push(runningGlobal + posInTier++)
            const globalFracRank = occupied.reduce((s, p) => s + p, 0) / occupied.length
            for (const it of g.items) {
              enriched.push({ entryId: it.entryId, tier, localRank, globalFracRank })
            }
          })
          runningGlobal += inTier.length
        }

        for (const item of list.items) {
          if (!item.tier || TIER_SCORE[item.tier] === undefined) continue
          if (!tierData[item.entryId]) tierData[item.entryId] = { totalScore: 0, count: 0 }
          tierData[item.entryId].totalScore += TIER_SCORE[item.tier]
          tierData[item.entryId].count += 1
          if (!tierDistData[item.entryId]) tierDistData[item.entryId] = {}
          tierDistData[item.entryId][item.tier] = (tierDistData[item.entryId][item.tier] ?? 0) + 1
        }
        for (const e of enriched) {
          // Every tier that has items contributes to avgRank in the new
          // model; sumLog uses the fractional global rank so ties don't
          // all collapse onto the same integer.
          if (!rankData[e.entryId]) rankData[e.entryId] = { sumLog: 0, count: 0 }
          rankData[e.entryId].sumLog += Math.log(e.globalFracRank)
          rankData[e.entryId].count += 1
          if (!rankPositionsData[e.entryId]) rankPositionsData[e.entryId] = []
          rankPositionsData[e.entryId].push(e.globalFracRank)
        }
        // Favorite = the item(s) sharing rank #1 in the top-most tier that has
        // items. Previously only one favorite per list was counted; we keep
        // that convention and attribute the vote to the first entry of the
        // top rank group when there are ties.
        for (const tier of TIERS) {
          const top = enriched.find(e => e.tier === tier && e.localRank === 1)
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
            kind: (e.kind === 'SAGA' ? 'SAGA' : 'FILM') as 'FILM' | 'SAGA',
            avgRank: rd && rd.count > 0 ? Math.exp(rd.sumLog / rd.count) : null,
            rankCount: rd?.count ?? 0,
            avgTierScore: td && td.count > 0 ? td.totalScore / td.count : null,
            tierCount: td?.count ?? 0,
            favoriteCount: favoriteData[e.id] ?? 0,
            tierDistribution: tierDistData[e.id] ?? {},
            rankPositions: (rankPositionsData[e.id] ?? []).slice().sort((a, b) => a - b),
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
