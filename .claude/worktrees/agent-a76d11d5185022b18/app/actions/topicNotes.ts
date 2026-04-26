'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function saveUserTopicNote(topicSlug: string, content: string) {
  const session = await getSession()
  if (!session) return { error: 'Non connecté' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return { error: 'Topic introuvable' }

  if (!content.trim()) {
    await prisma.userTopicNote.deleteMany({
      where: { userId: session.userId, topicId: topic.id },
    })
  } else {
    await prisma.userTopicNote.upsert({
      where: { userId_topicId: { userId: session.userId, topicId: topic.id } },
      create: { userId: session.userId, topicId: topic.id, content: content.trim() },
      update: { content: content.trim() },
    })
  }

  revalidatePath(`/fr/topics/${topicSlug}`)
  revalidatePath(`/en/topics/${topicSlug}`)
  return { success: true }
}
