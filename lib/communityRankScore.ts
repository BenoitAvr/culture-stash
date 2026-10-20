import type { RankEntry } from '@/lib/communityRankData'

// Prod-baseline shrinkage (K=2) kept — this knob isn't where popularity
// weight should be dialled.
const RANK_SHRINKAGE_K = 2
const TIER_SHRINKAGE_K = 2
const TIER_PRIOR_MEAN = 4 // « Assez bien », tier neutre (milieu de l'échelle EX=7…MA=1)
// Rank bonus curve kept close to the historical 18/8 (now 15/7) — a quality
// indicator, not a popularity one, so a well-ranked film like 3 Billboards
// still earns the full podium boost.
const RANK_BONUS_MAX = 15
const RANK_BONUS_SLOPE = 7

// Linear map avgTier (1..7) → virtual rank position used for Vrac-only films.
// Anchored so EX (7) maps to virtualRank 10 (top tier, not #1 globally) — a
// 1-vote EX in Vrac shouldn't out-rank a real classement, only stand alongside
// a "top 10" position. Lower tiers spread linearly down to ~90.
function virtualRankFromTier(avgTier: number): number {
  return Math.max(1, 10 + (7 - avgTier) * 13.3)
}

// Weight that scales the raw rank bonus by vote count. The old linear
// shape `count/(count+K)` reached ~91% at 20 votes vs 61% at 5 — vote
// count carried too much weight. The sqrt variant flattens the curve:
// 5 votes keeps 61%, 20 votes stays at 76%. A film with few confident
// voters is no longer heavily penalised, which is what the brief asked.
function countWeight(count: number, k: number): number {
  const s = Math.sqrt(count)
  return s / (s + Math.sqrt(k))
}

export function combinedScore(e: RankEntry) {
  const shrunkTier =
    e.avgTierScore !== null
      ? (e.avgTierScore * e.tierCount + TIER_PRIOR_MEAN * TIER_SHRINKAGE_K) / (e.tierCount + TIER_SHRINKAGE_K)
      : 0

  let rankBonus = 0
  if (e.avgRank && e.rankCount > 0) {
    const rawRankBonus = Math.max(0, RANK_BONUS_MAX - RANK_BONUS_SLOPE * Math.log10(e.avgRank))
    rankBonus = rawRankBonus * countWeight(e.rankCount, RANK_SHRINKAGE_K)
  } else if (e.avgTierScore !== null && e.tierCount > 0) {
    // Vrac only — derive a virtual rank from the average tier so a well-rated
    // unranked film still earns a fair share of the rank component.
    const virtualRank = virtualRankFromTier(e.avgTierScore)
    const rawRankBonus = Math.max(0, RANK_BONUS_MAX - RANK_BONUS_SLOPE * Math.log10(virtualRank))
    rankBonus = rawRankBonus * countWeight(e.tierCount, RANK_SHRINKAGE_K)
  }

  return shrunkTier * 4 + rankBonus
}
