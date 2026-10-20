import type { RankEntry } from '@/lib/communityRankData'

// Stronger priors than before (2 → 8/5): a few 1-vote films were climbing
// past consensus favourites. Doubling+ the shrinkage pulls low-sample scores
// firmly back toward the catalogue average until enough votes accumulate.
const RANK_SHRINKAGE_K = 5
const TIER_SHRINKAGE_K = 8
const TIER_PRIOR_MEAN = 4 // « Assez bien », tier neutre (milieu de l'échelle EX=7…MA=1)

// Linear map avgTier (1..7) → virtual rank position used for Vrac-only films.
// Anchored so EX (7) maps to virtualRank 10 (top tier, not #1 globally) — a
// 1-vote EX in Vrac shouldn't out-rank a real classement, only stand alongside
// a "top 10" position. Lower tiers spread linearly down to ~90.
function virtualRankFromTier(avgTier: number): number {
  return Math.max(1, 10 + (7 - avgTier) * 13.3)
}

export function combinedScore(e: RankEntry) {
  const shrunkTier =
    e.avgTierScore !== null
      ? (e.avgTierScore * e.tierCount + TIER_PRIOR_MEAN * TIER_SHRINKAGE_K) / (e.tierCount + TIER_SHRINKAGE_K)
      : 0

  let rankBonus = 0
  if (e.avgRank && e.rankCount > 0) {
    // Real rank from at least one classement. The raw bonus was 18 at rank
    // #1 — too hot: a lonely #1 could leap-frog a consensus Top 10. Scaled
    // down to 14 so the overall podium reflects both consensus and rank.
    const rawRankBonus = Math.max(0, 14 - 7 * Math.log10(e.avgRank))
    rankBonus = rawRankBonus * (e.rankCount / (e.rankCount + RANK_SHRINKAGE_K))
  } else if (e.avgTierScore !== null && e.tierCount > 0) {
    // Vrac only — derive a virtual rank from the average tier so a well-rated
    // unranked film still earns a fair share of the rank component.
    const virtualRank = virtualRankFromTier(e.avgTierScore)
    const rawRankBonus = Math.max(0, 14 - 7 * Math.log10(virtualRank))
    rankBonus = rawRankBonus * (e.tierCount / (e.tierCount + RANK_SHRINKAGE_K))
  }

  return shrunkTier * 4 + rankBonus
}
