'use server'

import { getCommunityData, getCommunityDataForGenre } from '@/lib/communityRankData'
import type { RankEntry } from '@/lib/communityRankData'

export async function fetchAllRankEntries(
  slug: string,
  lang: string,
  genreId?: number,
): Promise<RankEntry[]> {
  const data = typeof genreId === 'number'
    ? await getCommunityDataForGenre(slug, lang, genreId)
    : await getCommunityData(slug, lang)
  return data?.entries ?? []
}
