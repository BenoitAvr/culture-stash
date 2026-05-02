import type { RankEntry } from '@/lib/communityRankData'

export function rankPositionBonus(position: number): number {
  return Math.max(0, 18 - 8 * Math.log10(position))
}

export function combinedScore(e: RankEntry) {
  return (e.avgTierScore ?? 0) * 3 + (e.avgRankBonus ?? 0) + e.favoriteCount + e.tierCount * 0.2
}
