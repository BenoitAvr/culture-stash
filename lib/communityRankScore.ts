import type { RankEntry } from '@/lib/communityRankData'

// Back to the original shrinkage (K=2 for both) — raising it was pushing
// vote count's influence UP, the opposite of what the brief asked for.
const RANK_SHRINKAGE_K = 2
const TIER_SHRINKAGE_K = 2
const TIER_PRIOR_MEAN = 4 // « Assez bien », tier neutre (milieu de l'échelle EX=7…MA=1)
// Max contribution of the rank bonus to the final score. Lowering this
// (from the historical 18 to 11) is the real knob for "less weight on
// popularity": it caps how much a well-voted ranked film can pull ahead
// of a quietly-rated gem. shrunkTier * 4 keeps a 28-point ceiling, so
// the ratio of quality:popularity goes from ~60/40 to ~72/28.
const RANK_BONUS_MAX = 11
// Slope so that log10(100) ≈ 2 brings the bonus close to zero at rank 100.
const RANK_BONUS_SLOPE = 5

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
    const rawRankBonus = Math.max(0, RANK_BONUS_MAX - RANK_BONUS_SLOPE * Math.log10(e.avgRank))
    rankBonus = rawRankBonus * (e.rankCount / (e.rankCount + RANK_SHRINKAGE_K))
  } else if (e.avgTierScore !== null && e.tierCount > 0) {
    // Vrac only — derive a virtual rank from the average tier so a well-rated
    // unranked film still earns a fair share of the rank component.
    const virtualRank = virtualRankFromTier(e.avgTierScore)
    const rawRankBonus = Math.max(0, RANK_BONUS_MAX - RANK_BONUS_SLOPE * Math.log10(virtualRank))
    rankBonus = rawRankBonus * (e.tierCount / (e.tierCount + RANK_SHRINKAGE_K))
  }

  return shrunkTier * 4 + rankBonus
}
