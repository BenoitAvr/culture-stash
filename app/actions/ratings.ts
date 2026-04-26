'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function setRating(resourceId: string, topicSlug: string, stars: number | null) {
  const session = await getSession()
  if (!session) return { error: 'Connexion requise' }

  if (stars === null) {
    await prisma.rating.deleteMany({
      where: { resourceId, userId: session.userId },
    })
  } else {
    await prisma.rating.upsert({
      where: { resourceId_userId: { resourceId, userId: session.userId } },
      update: { stars },
      create: { resourceId, userId: session.userId, stars },
    })
  }

  revalidatePath(`/fr/topics/${topicSlug}`)
  revalidatePath(`/en/topics/${topicSlug}`)
  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
}
