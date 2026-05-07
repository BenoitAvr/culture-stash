import type { RankEntry } from '@/lib/communityRankData'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_SCORE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }

const RANK_SHRINKAGE_K = 2
const TIER_SHRINKAGE_K = 2
const TIER_PRIOR_MEAN = 4 // « Assez bien », tier neutre (milieu de l'échelle EX=7…MA=1)
// Vrac (no personal ranking) is a weaker signal than a real classement —
// scale the derived rank bonus down so a 3-vote Vrac EX doesn't out-rank
// a real #2 placement just because shrinkage favors quantity.
const VRAC_RANK_PENALTY = 0.6

// Weighted-by-value mean on the 1..7 tier scale: each vote's contribution
// is proportional to its own rating, so good votes pull the score up more
// than bad votes drag it down. Equivalent to sum(v²) / sum(v) over votes.
//
// On [MA, BO, TB, EX] = [1,5,6,7]: arithmetic mean = 4.75, this = 5.84.
// On [MA, EX, EX, EX] = [1,7,7,7]: arithmetic mean = 5.5, this = 6.73.
// On [EX, MA, MA, MA] = [7,1,1,1]: arithmetic mean = 2.5, this = 5.2.
// (i.e. a single EX in a sea of MA still pulls hard — that's the asymmetry.)
function qualityWeightedScore(distribution: Record<string, number>, count: number): number | null {
  if (count === 0) return null
  let weightedSum = 0
  let weightTotal = 0
  for (const tier of TIERS) {
    const c = distribution[tier] ?? 0
    if (c === 0) continue
    const v = TIER_SCORE[tier]
    weightedSum += v * v * c
    weightTotal += v * c
  }
  if (weightTotal === 0) return null
  return weightedSum / weightTotal
}

// Linear map tier value (1..7) → virtual rank position used for Vrac-only films.
// Anchored so EX (7) maps to virtualRank 10 (top tier, not #1 globally) — a
// 1-vote EX in Vrac shouldn't out-rank a real classement, only stand alongside
// a "top 10" position. Lower tiers spread linearly down to ~90.
function virtualRankFromTier(tier: number): number {
  return Math.max(1, 10 + (7 - tier) * 13.3)
}

export function combinedScore(e: RankEntry) {
  const qualityTier = qualityWeightedScore(e.tierDistribution, e.tierCount)
  const shrunkTier =
    qualityTier !== null
      ? (qualityTier * e.tierCount + TIER_PRIOR_MEAN * TIER_SHRINKAGE_K) / (e.tierCount + TIER_SHRINKAGE_K)
      : 0

  let rankBonus = 0
  if (e.avgRank && e.rankCount > 0) {
    // Real rank from at least one classement
    const rawRankBonus = Math.max(0, 18 - 8 * Math.log10(e.avgRank))
    rankBonus = rawRankBonus * (e.rankCount / (e.rankCount + RANK_SHRINKAGE_K))
  } else if (qualityTier !== null && e.tierCount > 0) {
    // Vrac only — derive a virtual rank from the quality-weighted tier so
    // a well-rated unranked film still earns a fair share of the rank
    // component, but scaled down vs a real classement (see VRAC_RANK_PENALTY).
    const virtualRank = virtualRankFromTier(qualityTier)
    const rawRankBonus = Math.max(0, 18 - 8 * Math.log10(virtualRank))
    rankBonus = rawRankBonus * (e.tierCount / (e.tierCount + RANK_SHRINKAGE_K)) * VRAC_RANK_PENALTY
  }

  return shrunkTier * 5 + rankBonus
}
