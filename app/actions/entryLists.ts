'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath, revalidateTag } from 'next/cache'

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
    entry: { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null }
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
        include: { entry: { select: { id: true, title: true, titleEn: true, year: true, cover: true } } },
        orderBy: { position: 'asc' },
      },
    },
  })

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
  revalidateTag(`rank-${topicSlug}`, 'max')

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
  revalidateTag(`rank-${topicSlug}`, 'max')
}

const TIER_LABEL_TO_CODE: Record<string, string> = {
  'excellent': 'EX',
  'très bon': 'TB',
  'tres bon': 'TB',
  'bon': 'BO',
  'assez bien': 'AB',
  'passable': 'PA',
  'insuffisant': 'IN',
  'mauvais': 'MA',
}

export type ImportMarkdownResult =
  | { ok: true; imported: number; unmatched: string[] }
  | { ok: false; error: 'not-logged-in' | 'topic-not-found' | 'parse-empty' }

export async function importMarkdownList(topicSlug: string, markdown: string): Promise<ImportMarkdownResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  const topic = await prisma.topic.findUnique({
    where: { slug: topicSlug },
    include: { entries: { select: { id: true, title: true, titleEn: true } } },
  })
  if (!topic) return { ok: false, error: 'topic-not-found' }

  // Parse markdown
  type ParsedItem = { title: string; tier: string; position: number | null; note: string | null }
  const parsed: ParsedItem[] = []
  const rankedTiersSet = new Set<string>()
  let currentTier: string | null = null
  let positionInTier = 0

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const tierMatch = line.match(/^##\s+(.+?)\s*$/)
    if (tierMatch) {
      const label = tierMatch[1].toLowerCase().trim()
      currentTier = TIER_LABEL_TO_CODE[label] ?? null
      positionInTier = 0
      continue
    }
    if (!currentTier) continue

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/)
    const bulletMatch = line.match(/^[-*+]\s+(.+)$/)
    const itemText = numberedMatch?.[1] ?? bulletMatch?.[1]
    if (!itemText) continue

    // "Title (1999) — note" → split note
    const noteIdx = itemText.indexOf('—')
    let titleAndYear = noteIdx >= 0 ? itemText.slice(0, noteIdx).trim() : itemText.trim()
    const note = noteIdx >= 0 ? itemText.slice(noteIdx + 1).trim() : null

    // Strip trailing "(1999)"
    const titleOnly = titleAndYear.replace(/\s*\(\d{4}\)\s*$/, '').trim()
    if (!titleOnly) continue

    if (numberedMatch) {
      positionInTier += 1
      rankedTiersSet.add(currentTier)
      parsed.push({ title: titleOnly, tier: currentTier, position: positionInTier, note })
    } else {
      parsed.push({ title: titleOnly, tier: currentTier, position: null, note })
    }
  }

  if (parsed.length === 0) return { ok: false, error: 'parse-empty' }

  // Match titles against entries (case-insensitive, fr or en)
  const titleToId = new Map<string, string>()
  for (const e of topic.entries) {
    titleToId.set(e.title.toLowerCase(), e.id)
    if (e.titleEn) titleToId.set(e.titleEn.toLowerCase(), e.id)
  }

  const tierItems: EntryListItem[] = []
  const unmatched: string[] = []
  for (const p of parsed) {
    const entryId = titleToId.get(p.title.toLowerCase())
    if (!entryId) {
      unmatched.push(p.title)
      continue
    }
    tierItems.push({
      entryId,
      tier: p.tier,
      position: p.position ?? undefined,
      note: p.note ?? undefined,
    })
  }

  // Drop ranked-tier flags for tiers that ended up with no matched items
  const tiersWithItems = new Set(tierItems.map(i => i.tier))
  const rankedTiers = Array.from(rankedTiersSet).filter(t => tiersWithItems.has(t))

  await upsertEntryList(session.userId, topic.id, 'TIER', tierItems, rankedTiers)
  await prisma.userEntryList.deleteMany({
    where: { userId: session.userId, topicId: topic.id, type: 'BOTH' },
  })

  revalidatePath(`/fr/rank/${topicSlug}`)
  revalidatePath(`/en/rank/${topicSlug}`)
  revalidateTag(`rank-${topicSlug}`, 'max')

  return { ok: true, imported: tierItems.length, unmatched }
}
