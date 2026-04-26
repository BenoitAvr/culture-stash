'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type ItemInput = {
  resourceId: string
  position?: number
  tier?: string
  note?: string
}

export async function saveUserList(
  topicSlug: string,
  type: 'RANKED' | 'TIER',
  items: ItemInput[],
  rankedTiers: string[] = []
) {
  const session = await getSession()
  if (!session) return { error: 'Non connecté' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return { error: 'Topic introuvable' }

  const existing = await prisma.userList.findUnique({
    where: { userId_topicId: { userId: session.userId, topicId: topic.id } },
  })

  const rankedTiersStr = rankedTiers.join(',') || null

  if (items.length === 0) {
    if (existing) await prisma.userList.delete({ where: { id: existing.id } })
  } else if (existing) {
    await prisma.userListItem.deleteMany({ where: { listId: existing.id } })
    await prisma.userList.update({
      where: { id: existing.id },
      data: { type, rankedTiers: rankedTiersStr, items: { create: items } },
    })
  } else {
    await prisma.userList.create({
      data: { userId: session.userId, topicId: topic.id, type, rankedTiers: rankedTiersStr, items: { create: items } },
    })
  }

  revalidatePath(`/fr/topics/${topicSlug}`)
  revalidatePath(`/en/topics/${topicSlug}`)
  return { success: true }
}
