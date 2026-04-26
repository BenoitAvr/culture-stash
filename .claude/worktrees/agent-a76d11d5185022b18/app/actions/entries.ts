'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type State = { error: string } | null

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
  const cover = (formData.get('cover') as string)?.trim() || null

  await prisma.entry.create({
    data: { topicId: topic.id, addedById: session.userId, title, year, cover },
  })

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
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
