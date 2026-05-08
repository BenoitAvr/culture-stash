// Guest-mode tier list stash, scoped to localStorage so visitors can build a
// list before signing in. On login, MergeAfterLogin uploads the stash via the
// applyGuestStash server action.
//
// Storage shape:
//   `${KEY_PREFIX}${topicSlug}` -> JSON GuestListPayload
//   `${INDEX_KEY}`              -> JSON string[] (slugs that currently have a stash)

const KEY_PREFIX = 'cs-guest-list:'
const INDEX_KEY = 'cs-guest-topics'

export type GuestListItem = {
  entryId: string
  tier?: string
  position?: number
  note?: string
}

export type GuestListPayload = {
  items: GuestListItem[]
  rankedTiers: string[]
  updatedAt: number
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readIndex(): string[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(slugs: string[]) {
  if (!isBrowser()) return
  const unique = Array.from(new Set(slugs))
  if (unique.length === 0) {
    window.localStorage.removeItem(INDEX_KEY)
  } else {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(unique))
  }
}

export function getGuestList(topicSlug: string): GuestListPayload | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + topicSlug)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GuestListPayload>
    if (!parsed || !Array.isArray(parsed.items)) return null
    return {
      items: parsed.items.filter(i => i && typeof i.entryId === 'string'),
      rankedTiers: Array.isArray(parsed.rankedTiers) ? parsed.rankedTiers.filter(t => typeof t === 'string') : [],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function saveGuestList(
  topicSlug: string,
  items: GuestListItem[],
  rankedTiers: string[],
): GuestListPayload {
  const payload: GuestListPayload = {
    items: items.map(i => ({
      entryId: i.entryId,
      tier: i.tier,
      position: i.position,
      note: i.note,
    })),
    rankedTiers: [...rankedTiers],
    updatedAt: Date.now(),
  }
  if (!isBrowser()) return payload
  if (items.length === 0) {
    clearGuestList(topicSlug)
    return payload
  }
  window.localStorage.setItem(KEY_PREFIX + topicSlug, JSON.stringify(payload))
  const idx = readIndex()
  if (!idx.includes(topicSlug)) writeIndex([...idx, topicSlug])
  return payload
}

export function clearGuestList(topicSlug: string) {
  if (!isBrowser()) return
  window.localStorage.removeItem(KEY_PREFIX + topicSlug)
  writeIndex(readIndex().filter(s => s !== topicSlug))
}

export function clearAllGuestLists() {
  if (!isBrowser()) return
  for (const slug of readIndex()) {
    window.localStorage.removeItem(KEY_PREFIX + slug)
  }
  writeIndex([])
}

export function listGuestTopicSlugs(): string[] {
  return readIndex()
}

export function readAllGuestLists(): Array<{ topicSlug: string; payload: GuestListPayload }> {
  if (!isBrowser()) return []
  const slugs = readIndex()
  const out: Array<{ topicSlug: string; payload: GuestListPayload }> = []
  for (const slug of slugs) {
    const payload = getGuestList(slug)
    if (payload && payload.items.length > 0) out.push({ topicSlug: slug, payload })
  }
  return out
}

export function totalGuestItems(): number {
  let total = 0
  for (const { payload } of readAllGuestLists()) total += payload.items.length
  return total
}
