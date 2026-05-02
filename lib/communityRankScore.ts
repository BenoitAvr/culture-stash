import type { RankEntry } from '@/lib/communityRankData'

export function combinedScore(e: RankEntry) {
  const rankBonus = e.avgRank ? Math.max(0, 8 - 3 * Math.log10(e.avgRank)) : 0
  return (e.avgTierScore ?? 0) * 4 + rankBonus + e.favoriteCount + e.tierCount * 0.2
}
