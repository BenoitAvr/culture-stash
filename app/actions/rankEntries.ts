'use server'

import { getCommunityData } from '@/lib/communityRankData'
import type { RankEntry } from '@/lib/communityRankData'

export async function fetchAllRankEntries(slug: string, lang: string): Promise<RankEntry[]> {
  const data = await getCommunityData(slug, lang)
  return data?.entries ?? []
}
