'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath, revalidateTag } from 'next/cache'
import { serializeGenreIds } from '@/lib/genres'

type State = { error: string } | null

type TmdbLookup = { cover: string | null; genres: string | null }

export async function fetchTmdbLookup(title: string, year: number | null): Promise<TmdbLookup> {
  const token = process.env.TMDB_READ_TOKEN
  if (!token) return { cover: null, genres: null }

  const params = new URLSearchParams({ query: title, language: 'fr-FR', include_adult: 'false' })
  if (year) params.set('year', String(year))

  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return { cover: null, genres: null }
    const data = await res.json()
    const first = data.results?.[0]
    const poster = first?.poster_path
    const genreIds: number[] = Array.isArray(first?.genre_ids) ? first.genre_ids : []
    return {
      cover: poster ? `https://image.tmdb.org/t/p/w500${poster}` : null,
      genres: serializeGenreIds(genreIds),
    }
  } catch {
    return { cover: null, genres: null }
  }
}

async function fetchRawgCover(title: string, year: number | null): Promise<string | null> {
  const key = process.env.RAWG_API_KEY
  if (!key) return null

  const params = new URLSearchParams({ key, search: title, page_size: '5' })
  if (year) params.set('dates', `${year}-01-01,${year}-12-31`)

  try {
    const res = await fetch(`https://api.rawg.io/api/games?${params}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.results?.[0]?.background_image ?? null
  } catch {
    return null
  }
}

export async function addEntry(
  topicSlug: string,
  _prev: State,
  formData: FormData
): Promise<State> {
  const session = await getSession()
  if (!session) return { error: 'Non connecté' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic || !topic.rankable) return { error: 'Sujet introuvable' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'Titre requis' }

  const kindRaw = (formData.get('kind') as string | null)?.trim()
  const kind = kindRaw === 'SAGA' ? 'SAGA' : 'FILM'

  // Sagas don't have a single release year, and we skip the TMDB cover
  // auto-fetch since a franchise title won't match a specific film.
  const yearRaw = kind === 'SAGA' ? '' : (formData.get('year') as string)
  const year = yearRaw ? parseInt(yearRaw) || null : null
  const coverRaw = (formData.get('cover') as string)?.trim() || null

  let cover: string | null = coverRaw
  let genres: string | null = null
  if (kind !== 'SAGA') {
    if (topicSlug === 'jeux-video') {
      cover = coverRaw ?? await fetchRawgCover(title, year)
    } else {
      const lookup = await fetchTmdbLookup(title, year)
      cover = coverRaw ?? lookup.cover
      // Only trust TMDB's `/search/movie` genre_ids for the films topic —
      // series/anime names collide with films too often otherwise.
      if (topicSlug === 'films') genres = lookup.genres
    }
  }

  await prisma.entry.create({
    data: { topicId: topic.id, addedById: session.userId, title, year, cover, kind, genres },
  })

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
  revalidateTag(`rank-${topicSlug}`, 'max')
  return null
}

export async function saveUserEntry(
  entryId: string,
  stars: number | null,
  note: string | null
): Promise<void> {
  const session = await getSession()
  if (!session) return

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { topic: true },
  })
  if (!entry) return

  if (stars === null && !note) {
    await prisma.userEntry.deleteMany({ where: { userId: session.userId, entryId } })
  } else {
    await prisma.userEntry.upsert({
      where: { userId_entryId: { userId: session.userId, entryId } },
      update: { ...(stars !== null ? { stars } : {}), ...(note !== null ? { note } : {}) },
      create: { userId: session.userId, entryId, stars, note },
    })
  }

  revalidatePath(`/fr/rank/${entry.topic.slug}`)
  revalidatePath(`/en/rank/${entry.topic.slug}`)
}
