'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function toggleLike(noteId: string, topicSlug: string) {
  const session = await getSession()
  if (!session) return { error: 'Connexion requise' }

  const existing = await prisma.like.findUnique({
    where: { noteId_userId: { noteId, userId: session.userId } },
  })

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } })
  } else {
    await prisma.like.create({ data: { noteId, userId: session.userId } })
  }

  revalidatePath(`/fr/topics/${topicSlug}`)
  revalidatePath(`/en/topics/${topicSlug}`)
}
