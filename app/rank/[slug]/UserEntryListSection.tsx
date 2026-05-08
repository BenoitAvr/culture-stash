'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { addEntry } from '@/app/actions/entries'
import { RankingEditor, type RankEditItem } from '@/app/components/RankingEditor'
import { getDict, type Dict } from '@/dictionaries/client'
import { pickTitle } from '@/lib/i18n'
import {
  GUEST_USER_ID,
  hydrateGuestList,
  saveGuestEntryLists,
} from '@/lib/guestListAdapter'

type EntryItem = { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null }

type ListItemData = {
  entryId: string
  position: number | null
  tier: string | null
  note: string | null
  entry: { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null }
}

export type UserEntryListData = {
  id: string
  userId: string
  userName: string
  username: string
  type: 'RANKED' | 'TIER' | 'BOTH'
  rankedTiers: string | null
  items: ListItemData[]
}

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']

export function UserEntryListSection({
  topicSlug, entries, lists, onListsChange, currentUserId,
  isEditing, setIsEditing, t,
}: {
  topicSlug: string
  entries: EntryItem[]
  lists: UserEntryListData[]
  onListsChange: (l: UserEntryListData[]) => void
  currentUserId: string | null
  isEditing: boolean
  setIsEditing: (v: boolean) => void
  t: Dict['rankings']
}) {
  const { lang } = useParams() as { lang: string }
  const tRank = getDict(lang).rank
  const boundAddEntry = addEntry.bind(null, topicSlug)
  const [addState, addFormAction, addPending] = useActionState(boundAddEntry, null)

  const isGuest = currentUserId === null
  const ownerId = currentUserId ?? GUEST_USER_ID

  // For guests, hydrate the list from localStorage on mount. Server-rendered
  // `initialLists` is empty for guests because their data lives in the browser.
  // We need the parent's `lists` to be populated before mounting RankingEditor,
  // because the editor reads its initial tier items once at mount and never
  // re-syncs from props — see RankingEditor's useState(initialTierItems).
  const [hydrated, setHydrated] = useState(!isGuest)
  useEffect(() => {
    if (!isGuest || hydrated) return
    const guestList = hydrateGuestList(topicSlug, entries)
    if (guestList) onListsChange([guestList])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, topicSlug])

  const myTierList = lists.find(l => l.userId === ownerId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  async function handleSave(tier: RankEditItem[], rankedTiers: string[]) {
    if (tier.length === 0) {
      if (myTierList) {
        if (isGuest) {
          saveGuestEntryLists(topicSlug, entries, [], [])
        } else {
          await saveUserEntryLists(topicSlug, [], [], [])
        }
        onListsChange(lists.filter(l => l.userId !== ownerId))
      }
      return
    }
    // Positions stored in state are within-tier (1, 2, 3 per tier).
    // Convert to global rank (across all ranked tiers combined) before saving.
    let globalPos = 1
    const globalizedItems: RankEditItem[] = []
    for (const t of TIERS) {
      const inTier = tier.filter(i => i.tier === t)
      if (rankedTiers.includes(t)) {
        const sorted = [...inTier].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        for (const item of sorted) globalizedItems.push({ ...item, position: globalPos++ })
      } else {
        // Non-ranked items don't get a position, but they still occupy slots
        // in the global order — same as tierOffset in the display formula.
        globalPos += inTier.length
        for (const item of inTier) globalizedItems.push({ ...item, position: undefined })
      }
    }

    if (isGuest) {
      const guestList = saveGuestEntryLists(
        topicSlug,
        entries,
        globalizedItems.map(i => ({ entryId: i.id, tier: i.tier, position: i.position, note: i.note })),
        rankedTiers,
      )
      onListsChange(guestList ? [guestList] : lists.filter(l => l.userId !== ownerId))
      return
    }

    const updated = await saveUserEntryLists(
      topicSlug,
      [],
      globalizedItems.map(i => ({ entryId: i.id, tier: i.tier, position: i.position, note: i.note })),
      rankedTiers
    )
    onListsChange([...lists.filter(l => l.userId !== currentUserId), ...updated])
  }

  if (!isEditing) return null

  // Avoid flashing an empty editor for guests before localStorage hydrates.
  if (isGuest && !hydrated) return <div style={{ minHeight: '60vh' }} />

  // For a brand new list, default to ranking the top tier (EX) so users
  // discover the rank-within-tier feature on their best films.
  const initRankedTiers = myTierList
    ? (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    : ['EX']
  // Normalize global DB positions back to within-tier (1, 2, 3…) so the editor
  // state is consistent and dropOnTier's tierCount+1 always appends correctly.
  const initTierItems: RankEditItem[] = myTierList
    ? TIERS.flatMap(t => {
        const inTier = myTierList.items
          .filter(i => i.tier === t)
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        return inTier.map((i, idx) => ({
          id: i.entryId,
          tier: t,
          position: initRankedTiers.includes(t) ? idx + 1 : undefined,
          note: i.note ?? undefined,
        }))
      })
    : []

  return (
    <div style={{ paddingBottom: 28 }}>
      {isGuest && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'var(--accent-faint)',
            border: '1px solid var(--accent-muted)',
            color: 'var(--accent-fg)',
            fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}
        >
          <span aria-hidden style={{ fontSize: 15 }}>💾</span>
          <span style={{ flex: 1, minWidth: 220 }}>
            {lang === 'fr'
              ? 'Mode invité — ta liste est sauvegardée dans ce navigateur. Connecte-toi pour la garder pour de bon et la partager.'
              : 'Guest mode — your list is saved in this browser. Sign in to keep it across devices and share it.'}
          </span>
          <a
            href={`/${lang}/auth/login?redirect=${encodeURIComponent(`/${lang}/rank/${topicSlug}`)}`}
            style={{
              padding: '6px 12px', borderRadius: 7,
              background: 'var(--btn)', color: 'var(--btn-text)',
              fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            {lang === 'fr' ? 'Se connecter' : 'Sign in'}
          </a>
        </div>
      )}
      <RankingEditor
        items={entries.map(e => ({ id: e.id, label: pickTitle(e, lang), suffix: e.year?.toString(), cover: e.cover }))}
        initialTierItems={initTierItems}
        initialRankedTiers={initRankedTiers}
        hasExisting={!!myTierList}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        t={t}
        addFormAction={isGuest ? undefined : addFormAction}
        addPending={addPending}
        addError={addState?.error ?? null}
        addEntryLabel={tRank.addEntryTitle}
      />
    </div>
  )
}
