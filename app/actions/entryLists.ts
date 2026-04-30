'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type EntryListItem = { entryId: string; position?: number; tier?: string; note?: string }

export type SavedEntryList = {
  id: string
  userId: string
  userName: string
  username: string
  type: 'RANKED' | 'TIER' | 'BOTH'
  rankedTiers: string | null
  items: Array<{
    entryId: string
    position: number | null
    tier: string | null
    note: string | null
    entry: { id: string; title: string; year: number | null; cover: string | null }
  }>
}

async function upsertEntryList(
  userId: string,
  topicId: string,
  type: 'RANKED' | 'TIER',
  items: EntryListItem[],
  rankedTiers: string[]
) {
  const rankedTiersStr = rankedTiers.length > 0 ? rankedTiers.join(',') : null

  if (items.length === 0) {
    await prisma.userEntryList.deleteMany({ where: { userId, topicId, type } })
    return
  }

  const existing = await prisma.userEntryList.findFirst({ where: { userId, topicId, type } })
  const mapped = items.map(i => ({
    entryId: i.entryId,
    position: i.position ?? null,
    tier: i.tier ?? null,
    note: i.note ?? null,
  }))

  if (existing) {
    await prisma.userEntryItem.deleteMany({ where: { listId: existing.id } })
    await prisma.userEntryList.update({
      where: { id: existing.id },
      data: { type, rankedTiers: rankedTiersStr, items: { create: mapped } },
    })
  } else {
    await prisma.userEntryList.create({
      data: { userId, topicId, type, rankedTiers: rankedTiersStr, items: { create: mapped } },
    })
  }
}

export async function saveUserEntryLists(
  topicSlug: string,
  rankItems: EntryListItem[],
  tierItems: EntryListItem[],
  rankedTiers: string[] = []
): Promise<SavedEntryList[]> {
  const session = await getSession()
  if (!session) return []

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return []

  await prisma.userEntryList.deleteMany({
    where: { userId: session.userId, topicId: topic.id, type: 'BOTH' },
  })

  try {
    await upsertEntryList(session.userId, topic.id, 'RANKED', rankItems, [])
  } catch (e) {
    console.error('[saveUserEntryLists] RANKED upsert failed:', e)
    return []
  }
  try {
    await upsertEntryList(session.userId, topic.id, 'TIER', tierItems, rankedTiers)
  } catch (e) {
    console.error('[saveUserEntryLists] TIER upsert failed:', e)
    return []
  }

  const fresh = await prisma.userEntryList.findMany({
    where: { userId: session.userId, topicId: topic.id },
    include: {
      items: {
        include: { entry: { select: { id: true, title: true, year: true, cover: true } } },
        orderBy: { position: 'asc' },
      },
    },
  })

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)

  return fresh.map(l => ({
    id: l.id,
    userId: session.userId,
    userName: session.name,
    username: session.username,
    type: l.type as 'RANKED' | 'TIER' | 'BOTH',
    rankedTiers: l.rankedTiers,
    items: l.items.map(i => ({
      entryId: i.entryId,
      position: i.position,
      tier: i.tier,
      note: i.note,
      entry: i.entry,
    })),
  }))
}

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

  await upsertEntryList(session.userId, topic.id, type, items, rankedTiers)

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
}
