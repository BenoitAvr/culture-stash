import type { RankEntry } from '@/lib/communityRankData'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_SCORE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }

const RANK_SHRINKAGE_K = 2
const TIER_SHRINKAGE_K = 2
const TIER_PRIOR_MEAN = 4 // « Assez bien », tier neutre (milieu de l'échelle EX=7…MA=1)

// Continuous median on the 1..7 tier scale — no rounding, so a 4-vote
// distribution like [MA, BO, TB, EX] yields 5.5, not the rounded "TB"
// shown in the mention chip. This keeps the score smooth.
function medianTierScore(distribution: Record<string, number>, count: number): number | null {
  if (count === 0) return null
  const values: number[] = []
  for (const tier of TIERS) {
    const c = distribution[tier] ?? 0
    const v = TIER_SCORE[tier]
    for (let i = 0; i < c; i++) values.push(v)
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
}

// Linear map tier value (1..7) → virtual rank position used for Vrac-only films.
// Anchored so EX (7) maps to virtualRank 10 (top tier, not #1 globally) — a
// 1-vote EX in Vrac shouldn't out-rank a real classement, only stand alongside
// a "top 10" position. Lower tiers spread linearly down to ~90.
function virtualRankFromTier(tier: number): number {
  return Math.max(1, 10 + (7 - tier) * 13.3)
}

export function combinedScore(e: RankEntry) {
  const medianTier = medianTierScore(e.tierDistribution, e.tierCount)
  const shrunkTier =
    medianTier !== null
      ? (medianTier * e.tierCount + TIER_PRIOR_MEAN * TIER_SHRINKAGE_K) / (e.tierCount + TIER_SHRINKAGE_K)
      : 0

  let rankBonus = 0
  if (e.avgRank && e.rankCount > 0) {
    // Real rank from at least one classement
    const rawRankBonus = Math.max(0, 18 - 8 * Math.log10(e.avgRank))
    rankBonus = rawRankBonus * (e.rankCount / (e.rankCount + RANK_SHRINKAGE_K))
  } else if (medianTier !== null && e.tierCount > 0) {
    // Vrac only — derive a virtual rank from the median tier so a well-rated
    // unranked film still earns a fair share of the rank component.
    const virtualRank = virtualRankFromTier(medianTier)
    const rawRankBonus = Math.max(0, 18 - 8 * Math.log10(virtualRank))
    rankBonus = rawRankBonus * (e.tierCount / (e.tierCount + RANK_SHRINKAGE_K))
  }

  return shrunkTier * 4 + rankBonus
}
