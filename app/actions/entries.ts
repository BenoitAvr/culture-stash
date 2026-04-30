'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath, revalidateTag } from 'next/cache'

type State = { error: string } | null

async function fetchTmdbCover(title: string, year: number | null): Promise<string | null> {
  const token = process.env.TMDB_READ_TOKEN
  if (!token) return null

  const params = new URLSearchParams({ query: title, language: 'fr-FR', include_adult: 'false' })
  if (year) params.set('year', String(year))

  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const poster = data.results?.[0]?.poster_path
    return poster ? `https://image.tmdb.org/t/p/w500${poster}` : null
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

  const yearRaw = formData.get('year') as string
  const year = yearRaw ? parseInt(yearRaw) || null : null
  const coverRaw = (formData.get('cover') as string)?.trim() || null
  const cover = coverRaw ?? await fetchTmdbCover(title, year)

  await prisma.entry.create({
    data: { topicId: topic.id, addedById: session.userId, title, year, cover },
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
