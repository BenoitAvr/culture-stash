import type { RankEntry } from '@/lib/communityRankData'

const RANK_SHRINKAGE_K = 2
const TIER_SHRINKAGE_K = 2
const TIER_PRIOR_MEAN = 4 // « Assez bien », tier neutre (milieu de l'échelle EX=7…MA=1)

export function combinedScore(e: RankEntry) {
  const rawRankBonus = e.avgRank ? Math.max(0, 18 - 8 * Math.log10(e.avgRank)) : 0
  const rankBonus = rawRankBonus * (e.rankCount / (e.rankCount + RANK_SHRINKAGE_K))
  const shrunkTier =
    e.avgTierScore !== null
      ? (e.avgTierScore * e.tierCount + TIER_PRIOR_MEAN * TIER_SHRINKAGE_K) / (e.tierCount + TIER_SHRINKAGE_K)
      : 0
  return shrunkTier * 3 + rankBonus + e.favoriteCount + e.tierCount * 0.2
}
