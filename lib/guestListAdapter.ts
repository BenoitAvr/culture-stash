// Adapter that turns the raw localStorage stash (lib/guestList) into the
// UserEntryListData shape consumed by the editor and community page. Joining
// happens client-side using the entries data already passed to those views,
// so we never need to query Prisma for a guest.

import {
  getGuestList,
  saveGuestList,
  clearGuestList,
  type GuestListItem,
} from './guestList'
import type { UserEntryListData } from '@/app/rank/[slug]/UserEntryListSection'

export const GUEST_USER_ID = '__guest__'
export const GUEST_USERNAME = 'guest'
export const GUEST_DISPLAY_NAME = 'Invité'

type EntryShape = {
  id: string
  title: string
  titleEn: string | null
  year: number | null
  cover: string | null
}

export function buildGuestList(
  topicSlug: string,
  entries: EntryShape[],
  items: GuestListItem[],
  rankedTiers: string[],
): UserEntryListData | null {
  if (items.length === 0) return null
  const byId = new Map(entries.map(e => [e.id, e]))
  const joined = items
    .map(i => {
      const entry = byId.get(i.entryId)
      if (!entry) return null
      return {
        entryId: i.entryId,
        position: i.position ?? null,
        tier: i.tier ?? null,
        note: i.note ?? null,
        entry,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (joined.length === 0) return null

  return {
    id: `guest-${topicSlug}`,
    userId: GUEST_USER_ID,
    userName: GUEST_DISPLAY_NAME,
    username: GUEST_USERNAME,
    type: 'TIER',
    rankedTiers: rankedTiers.length > 0 ? rankedTiers.join(',') : null,
    items: joined,
  }
}

export function hydrateGuestList(
  topicSlug: string,
  entries: EntryShape[],
): UserEntryListData | null {
  const stash = getGuestList(topicSlug)
  if (!stash) return null
  return buildGuestList(topicSlug, entries, stash.items, stash.rankedTiers)
}

export function saveGuestEntryLists(
  topicSlug: string,
  entries: EntryShape[],
  items: GuestListItem[],
  rankedTiers: string[],
): UserEntryListData | null {
  if (items.length === 0) {
    clearGuestList(topicSlug)
    return null
  }
  saveGuestList(topicSlug, items, rankedTiers)
  return buildGuestList(topicSlug, entries, items, rankedTiers)
}
