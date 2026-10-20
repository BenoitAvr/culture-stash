import type { RankEntry } from '@/lib/communityRankData'

// The score has two raw components (tier mention × 4, plus a rank-based
// bonus) and we apply a *single* Bayesian shrinkage to the final sum.
// This matches the brief: don't dampen tier or rank in isolation — pull
// the whole score toward a neutral prior until there are enough votes to
// trust it. K is the "number of fictional votes" worth of prior weight;
// higher K means low-vote films regress harder.
const SCORE_SHRINKAGE_K = 1
const PRIOR_SCORE = 16 // ≈ "Assez bien" (4) tier contribution without rank bonus
const RANK_BONUS_MAX = 22
const RANK_BONUS_SLOPE = 10

// Linear map avgTier (1..7) → virtual rank position used for Vrac-only films.
// Anchored so EX (7) maps to virtualRank 10 (top tier, not #1 globally) — a
// 1-vote EX in Vrac shouldn't out-rank a real classement, only stand alongside
// a "top 10" position. Lower tiers spread linearly down to ~90.
function virtualRankFromTier(avgTier: number): number {
  return Math.max(1, 10 + (7 - avgTier) * 13.3)
}

export function combinedScore(e: RankEntry) {
  if (e.avgTierScore === null || e.tierCount === 0) return 0

  // Raw components — no per-component shrinkage, we handle it once at the
  // end against the final score.
  const rawTier = e.avgTierScore * 4

  let rawRankBonus = 0
  if (e.avgRank && e.rankCount > 0) {
    rawRankBonus = Math.max(0, RANK_BONUS_MAX - RANK_BONUS_SLOPE * Math.log10(e.avgRank))
  } else {
    const virtualRank = virtualRankFromTier(e.avgTierScore)
    rawRankBonus = Math.max(0, RANK_BONUS_MAX - RANK_BONUS_SLOPE * Math.log10(virtualRank))
  }

  const rawScore = rawTier + rawRankBonus

  // Final shrinkage: Bayesian pull of the raw score toward PRIOR_SCORE
  // weighted by K fictional votes. 1 real vote → ~14% actual + 86% prior.
  // 10 real votes → 63% actual + 37% prior. Beyond ~30 votes the prior
  // influence becomes negligible.
  const n = e.tierCount
  return (rawScore * n + PRIOR_SCORE * SCORE_SHRINKAGE_K) / (n + SCORE_SHRINKAGE_K)
}
