'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type EntryListItem = { entryId: string; position?: number; tier?: string; note?: string }

export async function saveUserEntryList(
  topicSlug: string,
  type: 'RANKED' | 'TIER',
  items: EntryListItem[]
): Promise<void> {
  const session = await getSession()
  if (!session) return

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return

  if (items.length === 0) {
    const existing = await prisma.userEntryList.findFirst({
      where: { userId: session.userId, topicId: topic.id, type },
    })
    if (existing) await prisma.userEntryList.delete({ where: { id: existing.id } })
  } else {
    const existing = await prisma.userEntryList.findFirst({
      where: { userId: session.userId, topicId: topic.id, type },
    })
    if (existing) {
      await prisma.userEntryItem.deleteMany({ where: { listId: existing.id } })
      await prisma.userEntryList.update({
        where: { id: existing.id },
        data: {
          items: { create: items.map(i => ({ entryId: i.entryId, position: i.position ?? null, tier: i.tier ?? null, note: i.note ?? null })) },
        },
      })
    } else {
      await prisma.userEntryList.create({
        data: {
          userId: session.userId,
          topicId: topic.id,
          type,
          items: { create: items.map(i => ({ entryId: i.entryId, position: i.position ?? null, tier: i.tier ?? null, note: i.note ?? null })) },
        },
      })
    }
  }

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
}
