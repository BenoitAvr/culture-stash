'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidateTag } from 'next/cache'
import type { GuestMergeStrategy } from './guestMerge'

// Public guest saves + login-time claim. Guests persist their tier list under
// an anonymous User row (anonymous=true) created on first save. The guest's
// User.id lives in localStorage so repeated edits update the same row and the
// claim flow (on login) can reassign the lists to the real account.
//
// Why not use the logged-in save path (saveUserEntryLists) with a guest cookie
// or similar: anonymous users still need their own stable User row so
// contributions keep flowing into the community ranking even if the browser
// localStorage is cleared, and so analytics can distinguish anonymous from
// authenticated contributors (filter on User.anonymous).

export type GuestSaveItem = { entryId: string; tier?: string | null; position?: number | null; note?: string | null }

export type GuestSaveResult =
  | { ok: false; error: 'topic-not-found' | 'logged-in' }
  | { ok: true; guestUserId: string }

// Create or reuse the caller's anonymous User and upsert their TIER list on
// `topicSlug`. Returns the anonymous User.id so the client can store it in
// localStorage. If `guestUserId` is given but no longer exists (or is not
// anonymous — defensive), a fresh anonymous user is created and the new id
// returned.
export async function saveGuestServerList(
  topicSlug: string,
  guestUserId: string | null,
  items: GuestSaveItem[],
  rankedTiers: string[],
): Promise<GuestSaveResult> {
  // Logged-in users should go through saveUserEntryLists instead so their
  // changes land on their real account. Refusing here is a safety net
  // against misuse of the guest path post-login.
  const session = await getSession()
  if (session) return { ok: false, error: 'logged-in' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return { ok: false, error: 'topic-not-found' }

  let anonUser = guestUserId
    ? await prisma.user.findFirst({ where: { id: guestUserId, anonymous: true } })
    : null

  if (!anonUser) {
    // Fresh anonymous account. Email is required+unique on User, so build a
    // throw-away one keyed on the generated cuid.
    anonUser = await prisma.user.create({
      data: {
        name: 'Invité',
        email: `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@local.culture-stash`,
        anonymous: true,
      },
    })
  }

  const rankedTiersStr = rankedTiers.length > 0 ? rankedTiers.join(',') : null

  if (items.length === 0) {
    // Nothing to save → drop any existing anonymous list on this topic. We
    // keep the anonymous User row (so the id in localStorage stays valid for
    // future topics).
    await prisma.userEntryList.deleteMany({
      where: { userId: anonUser.id, topicId: topic.id, type: { in: ['TIER', 'BOTH'] } },
    })
    revalidateTag(`rank-${topicSlug}`, 'max')
    return { ok: true, guestUserId: anonUser.id }
  }

  // Drop items referencing entries that don't belong to this topic — same
  // defensive filter the logged-in merge path applies.
  const validEntryIds = new Set<string>(
    (
      await prisma.entry.findMany({
        where: {
          id: { in: items.map(i => i.entryId) },
          topicId: topic.id,
        },
        select: { id: true },
      })
    ).map(e => e.id),
  )
  const mapped = items
    .filter(i => validEntryIds.has(i.entryId))
    .map(i => ({
      entryId: i.entryId,
      tier: i.tier ?? null,
      position: i.position ?? null,
      note: i.note ?? null,
    }))

  const existing = await prisma.userEntryList.findFirst({
    where: { userId: anonUser.id, topicId: topic.id, type: 'TIER' },
  })

  if (existing) {
    await prisma.userEntryItem.deleteMany({ where: { listId: existing.id } })
    await prisma.userEntryList.update({
      where: { id: existing.id },
      data: { rankedTiers: rankedTiersStr, items: { create: mapped } },
    })
  } else {
    await prisma.userEntryList.create({
      data: {
        userId: anonUser.id,
        topicId: topic.id,
        type: 'TIER',
        rankedTiers: rankedTiersStr,
        items: { create: mapped },
      },
    })
  }

  // Drop any stale BOTH variant so the data model stays consistent with the
  // logged-in save path.
  await prisma.userEntryList.deleteMany({
    where: { userId: anonUser.id, topicId: topic.id, type: 'BOTH' },
  })

  revalidateTag(`rank-${topicSlug}`, 'max')
  return { ok: true, guestUserId: anonUser.id }
}

export type ClaimConflict = { topicSlug: string; topicTitle: string; existingCount: number; guestCount: number }
export type ClaimUploadable = { topicSlug: string; topicTitle: string; guestCount: number }
export type ClaimPreview =
  | { ok: false; error: 'not-logged-in' | 'anon-not-found' }
  | { ok: true; conflicts: ClaimConflict[]; uploadable: ClaimUploadable[] }

// Returns which topics the anonymous user has that the logged-in user also
// has, so the client can prompt which side to keep before applying the
// strategy. Call before `claimAnonymousAccount`.
export async function previewAnonymousClaim(guestUserId: string): Promise<ClaimPreview> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  const anon = await prisma.user.findFirst({
    where: { id: guestUserId, anonymous: true },
    select: {
      id: true,
      userEntryLists: {
        where: { type: 'TIER' },
        select: {
          topic: { select: { slug: true, title: true } },
          items: { select: { id: true } },
        },
      },
    },
  })
  if (!anon) return { ok: false, error: 'anon-not-found' }

  const anonSlugs = anon.userEntryLists.map(l => l.topic.slug)
  if (anonSlugs.length === 0) return { ok: true, conflicts: [], uploadable: [] }

  const existingUserLists = await prisma.userEntryList.findMany({
    where: {
      userId: session.userId,
      topic: { slug: { in: anonSlugs } },
      type: { in: ['TIER', 'BOTH'] },
    },
    select: { topic: { select: { slug: true } }, items: { select: { id: true } } },
  })
  const existingBySlug = new Map(
    existingUserLists.map(l => [l.topic.slug, l.items.length]),
  )

  const conflicts: ClaimConflict[] = []
  const uploadable: ClaimUploadable[] = []
  for (const l of anon.userEntryLists) {
    const existingCount = existingBySlug.get(l.topic.slug) ?? 0
    if (existingCount > 0) {
      conflicts.push({
        topicSlug: l.topic.slug,
        topicTitle: l.topic.title,
        existingCount,
        guestCount: l.items.length,
      })
    } else {
      uploadable.push({
        topicSlug: l.topic.slug,
        topicTitle: l.topic.title,
        guestCount: l.items.length,
      })
    }
  }
  return { ok: true, conflicts, uploadable }
}

export type ClaimResult =
  | { ok: false; error: 'not-logged-in' | 'anon-not-found' }
  | { ok: true; applied: string[]; kept: string[] }

// Transfer every anonymous list to the logged-in account, applying `strategy`
// per topic that already has a server list on the real account:
//   - 'keep'    → leave the real account's list, discard the anonymous one.
//   - 'replace' → overwrite the real account's list with the anonymous one.
//   - 'merge'   → union by entryId; anonymous items win on conflict.
// After transfer the anonymous User and its remaining data are deleted
// (UserEntryList.user has onDelete: Cascade, so lists we chose to discard go
// away with it).
export async function claimAnonymousAccount(
  guestUserId: string,
  strategy: GuestMergeStrategy,
): Promise<ClaimResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  const anon = await prisma.user.findFirst({
    where: { id: guestUserId, anonymous: true },
    select: {
      id: true,
      userEntryLists: {
        where: { type: { in: ['TIER', 'BOTH'] } },
        include: {
          topic: { select: { id: true, slug: true } },
          items: true,
        },
      },
    },
  })
  if (!anon) return { ok: false, error: 'anon-not-found' }

  const applied: string[] = []
  const kept: string[] = []

  for (const anonList of anon.userEntryLists) {
    if (anonList.type === 'BOTH') continue // ignore stale BOTH rows

    const topic = anonList.topic
    const existingReal = await prisma.userEntryList.findFirst({
      where: { userId: session.userId, topicId: topic.id, type: { in: ['TIER', 'BOTH'] } },
      include: { items: true },
    })

    if (!existingReal) {
      // Simple reassign — no conflict.
      await prisma.userEntryList.update({
        where: { id: anonList.id },
        data: { userId: session.userId },
      })
      applied.push(topic.slug)
      revalidateTag(`rank-${topic.slug}`, 'max')
      continue
    }

    if (strategy === 'keep') {
      // Delete the anonymous list for this topic so it doesn't resurface.
      // (The anonymous user itself is cleaned up at the end.)
      kept.push(topic.slug)
      continue
    }

    type MappedItem = { entryId: string; tier: string | null; position: number | null; note: string | null }
    let nextItems: MappedItem[]
    let nextRankedTiers: string[]

    if (strategy === 'replace') {
      nextItems = anonList.items.map(i => ({
        entryId: i.entryId,
        tier: i.tier,
        position: i.position,
        note: i.note,
      }))
      nextRankedTiers = (anonList.rankedTiers ?? '').split(',').filter(Boolean)
    } else {
      // merge — anonymous items override real ones on conflict (the guest
      // just saved them, they are freshest).
      const realItems: MappedItem[] = existingReal.items.map(i => ({
        entryId: i.entryId,
        tier: i.tier,
        position: i.position,
        note: i.note,
      }))
      const byId = new Map<string, MappedItem>(realItems.map(i => [i.entryId, i]))
      for (const a of anonList.items) {
        byId.set(a.entryId, {
          entryId: a.entryId,
          tier: a.tier,
          position: a.position,
          note: a.note,
        })
      }
      nextItems = Array.from(byId.values())
      const realRanked = (existingReal.rankedTiers ?? '').split(',').filter(Boolean)
      const anonRanked = (anonList.rankedTiers ?? '').split(',').filter(Boolean)
      nextRankedTiers = Array.from(new Set([...realRanked, ...anonRanked]))
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
    await prisma.userEntryList.deleteMany({
      where: { userId: session.userId, topicId: topic.id, type: 'BOTH' },
    })

    applied.push(topic.slug)
    revalidateTag(`rank-${topic.slug}`, 'max')
  }

  // Drop the anonymous account — its remaining lists (type=BOTH, or TIER rows
  // we decided to keep-and-discard) go with it via onDelete: Cascade.
  await prisma.user.delete({ where: { id: anon.id } })

  return { ok: true, applied, kept }
}
