'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type EntryListItem = { entryId: string; position?: number; tier?: string; note?: string }

export async function saveUserEntryList(
  topicSlug: string,
  type: 'RANKED' | 'TIER',
  items: EntryListItem[],
  rankedTiers: string[] = []
): Promise<void> {
  const session = await getSession()
  if (!session) return

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return

  const rankedTiersStr = rankedTiers.length > 0 ? rankedTiers.join(',') : null

  if (items.length === 0) {
    await prisma.userEntryList.deleteMany({
      where: { userId: session.userId, topicId: topic.id, type },
    })
  } else {
    const existing = await prisma.userEntryList.findFirst({
      where: { userId: session.userId, topicId: topic.id, type },
    })
    if (existing) {
      await prisma.userEntryItem.deleteMany({ where: { listId: existing.id } })
      await prisma.userEntryList.update({
        where: { id: existing.id },
        data: {
          type,
          rankedTiers: rankedTiersStr,
          items: {
            create: items.map(i => ({
              entryId: i.entryId,
              position: i.position ?? null,
              tier: i.tier ?? null,
              note: i.note ?? null,
            })),
          },
        },
      })
    } else {
      await prisma.userEntryList.create({
        data: {
          userId: session.userId,
          topicId: topic.id,
          type,
          rankedTiers: rankedTiersStr,
          items: {
            create: items.map(i => ({
              entryId: i.entryId,
              position: i.position ?? null,
              tier: i.tier ?? null,
              note: i.note ?? null,
            })),
          },
        },
      })
    }
  }

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
}
