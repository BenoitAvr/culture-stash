'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidateTag } from 'next/cache'

export type GuestMergeStrategy = 'merge' | 'keep' | 'replace'

export type GuestPayloadItem = {
  entryId: string
  tier?: string | null
  position?: number | null
  note?: string | null
}

export type GuestTopicPayload = {
  topicSlug: string
  items: GuestPayloadItem[]
  rankedTiers: string[]
}

export type ConflictSummary = {
  topicSlug: string
  topicTitle: string
  existingCount: number
  guestCount: number
}

export type PreviewResult =
  | { ok: false; error: 'not-logged-in' }
  | {
      ok: true
      conflicts: ConflictSummary[]
      uploadable: Array<{ topicSlug: string; topicTitle: string; guestCount: number }>
      missing: string[] // slugs not found on the server
    }

export type ApplyResult =
  | { ok: false; error: 'not-logged-in' }
  | { ok: true; applied: string[]; skipped: string[] }

// Returns which topics already have a server list for the current user, so the
// client can ask the user which side to keep before applying anything.
export async function previewGuestStash(slugs: string[]): Promise<PreviewResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  if (slugs.length === 0) {
    return { ok: true, conflicts: [], uploadable: [], missing: [] }
  }

  const topics = await prisma.topic.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      title: true,
      userEntryLists: {
        where: { userId: session.userId, type: { in: ['TIER', 'BOTH'] } },
        select: { items: { select: { entryId: true } } },
      },
    },
  })

  const found = new Set(topics.map(t => t.slug))
  const missing = slugs.filter(s => !found.has(s))

  const conflicts: ConflictSummary[] = []
  const uploadable: Array<{ topicSlug: string; topicTitle: string; guestCount: number }> = []
  for (const t of topics) {
    const existingItems = t.userEntryLists[0]?.items.length ?? 0
    if (existingItems > 0) {
      conflicts.push({
        topicSlug: t.slug,
        topicTitle: t.title,
        existingCount: existingItems,
        guestCount: 0, // filled by client (it knows the guest payload size)
      })
    } else {
      uploadable.push({ topicSlug: t.slug, topicTitle: t.title, guestCount: 0 })
    }
  }

  return { ok: true, conflicts, uploadable, missing }
}

// Applies a global strategy across every topic in the payload. Strategies:
//
//  - 'keep'    → leave server lists as-is (and clear local stash on the client)
//  - 'replace' → overwrite server list with guest items only
//  - 'merge'   → union by entryId. Guest items win on conflict (they were
//                produced more recently, by the same user, in the same session).
//                Items only on the server stay as-is.
export async function applyGuestStash(
  payloads: GuestTopicPayload[],
  strategy: GuestMergeStrategy,
): Promise<ApplyResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  if (strategy === 'keep' || payloads.length === 0) {
    return { ok: true, applied: [], skipped: payloads.map(p => p.topicSlug) }
  }

  const topics = await prisma.topic.findMany({
    where: { slug: { in: payloads.map(p => p.topicSlug) } },
    select: { id: true, slug: true },
  })
  const topicBySlug = new Map(topics.map(t => [t.slug, t]))

  const applied: string[] = []
  const skipped: string[] = []

  for (const payload of payloads) {
    const topic = topicBySlug.get(payload.topicSlug)
    if (!topic) {
      skipped.push(payload.topicSlug)
      continue
    }

    // Drop guest items that don't reference a real entry in this topic.
    const validEntryIds = new Set<string>(
      (
        await prisma.entry.findMany({
          where: {
            id: { in: payload.items.map(i => i.entryId) },
            topicId: topic.id,
          },
          select: { id: true },
        })
      ).map(e => e.id),
    )
    const guestItems = payload.items.filter(i => validEntryIds.has(i.entryId))

    type MappedItem = { entryId: string; tier: string | null; position: number | null; note: string | null }

    let nextItems: MappedItem[]
    let nextRankedTiers: string[]

    if (strategy === 'replace') {
      nextItems = guestItems.map(i => ({
        entryId: i.entryId,
        tier: i.tier ?? null,
        position: i.position ?? null,
        note: i.note ?? null,
      }))
      nextRankedTiers = payload.rankedTiers
    } else {
      // strategy === 'merge': fold guest items on top of server items.
      const existing = await prisma.userEntryList.findFirst({
        where: { userId: session.userId, topicId: topic.id, type: { in: ['TIER', 'BOTH'] } },
        include: { items: true },
      })
      const serverItems: MappedItem[] = (existing?.items ?? []).map(i => ({
        entryId: i.entryId,
        tier: i.tier,
        position: i.position,
        note: i.note,
      }))
      const serverRanked = (existing?.rankedTiers ?? '').split(',').filter(Boolean)
      const byId = new Map<string, MappedItem>(serverItems.map(i => [i.entryId, i]))
      for (const g of guestItems) {
        byId.set(g.entryId, {
          entryId: g.entryId,
          tier: g.tier ?? null,
          position: g.position ?? null,
          note: g.note ?? null,
        })
      }
      nextItems = Array.from(byId.values())
      nextRankedTiers = Array.from(new Set([...serverRanked, ...payload.rankedTiers]))
    }

    if (nextItems.length === 0) {
      skipped.push(payload.topicSlug)
      continue
    }

    const rankedTiersStr = nextRankedTiers.length > 0 ? nextRankedTiers.join(',') : null

    const existingForUpsert = await prisma.userEntryList.findFirst({
      where: { userId: session.userId, topicId: topic.id, type: 'TIER' },
    })

    if (existingForUpsert) {
      await prisma.userEntryItem.deleteMany({ where: { listId: existingForUpsert.id } })
      await prisma.userEntryList.update({
        where: { id: existingForUpsert.id },
        data: { rankedTiers: rankedTiersStr, items: { create: nextItems } },
      })
    } else {
      await prisma.userEntryList.create({
        data: {
          userId: session.userId,
          topicId: topic.id,
          type: 'TIER',
          rankedTiers: rankedTiersStr,
          items: { create: nextItems },
        },
      })
    }

    // Drop any stale BOTH variant — the live save action does the same.
    await prisma.userEntryList.deleteMany({
      where: { userId: session.userId, topicId: topic.id, type: 'BOTH' },
    })

    revalidateTag(`rank-${payload.topicSlug}`, 'max')
    applied.push(payload.topicSlug)
  }

  return { ok: true, applied, skipped }
}
