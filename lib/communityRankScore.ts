import type { RankEntry } from '@/lib/communityRankData'

const RANK_SHRINKAGE_K = 2

export function combinedScore(e: RankEntry) {
  const rawRankBonus = e.avgRank ? Math.max(0, 18 - 8 * Math.log10(e.avgRank)) : 0
  const rankBonus = rawRankBonus * (e.rankCount / (e.rankCount + RANK_SHRINKAGE_K))
  return (e.avgTierScore ?? 0) * 3 + rankBonus + e.favoriteCount + e.tierCount * 0.2
}
