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

type EntryItem = { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null; tierCount?: number; score?: number; kind?: 'FILM' | 'SAGA' }

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
    // New rank-group model: `position` in state is the user's integer rank
    // within its tier (1, 2, 3…) with ties allowed. We persist those local
    // ranks directly — no globalization — so communityRankData / viewer can
    // compute fractional global rank from them.
    //
    // Every tier that has items counts as "ranked" (there is no vrac mode
    // anymore). `rankedTiers` is kept for backward compat with older readers:
    // we mark every tier containing at least one item as ranked.
    const activeTiers = TIERS.filter(t => tier.some(i => i.tier === t))
    const payload = tier.map(i => ({
      entryId: i.id,
      tier: i.tier,
      position: i.position,
      note: i.note,
    }))

    if (isGuest) {
      const guestList = saveGuestEntryLists(topicSlug, entries, payload, activeTiers)
      onListsChange(guestList ? [guestList] : lists.filter(l => l.userId !== ownerId))
      return
    }

    const updated = await saveUserEntryLists(topicSlug, [], payload, activeTiers)
    onListsChange([...lists.filter(l => l.userId !== currentUserId), ...updated])
  }

  if (!isEditing) return null

  // Avoid flashing an empty editor for guests before localStorage hydrates.
  if (isGuest && !hydrated) return <div style={{ minHeight: '60vh' }} />

  // Legacy flag only used to detect pre-migration "vrac" tiers so we can
  // collapse them to a single tied rank-1 group. New lists always treat every
  // tier that holds items as ranked.
  const legacyRankedTiers = myTierList
    ? (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    : null
  // Migrate on read:
  //   • legacy "ranked" tier with distinct positions → keep order, give each
  //     item a unique local rank (1, 2, 3…).
  //   • legacy "vrac" tier (position null or not in rankedTiers) → every item
  //     is tied at local rank 1.
  //   • new-model tier (positions already local, with possible ties) → use
  //     the stored position as-is after sorting.
  const initTierItems: RankEditItem[] = myTierList
    ? TIERS.flatMap(t => {
        const inTier = myTierList.items
          .filter(i => i.tier === t)
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        const isLegacyVrac = legacyRankedTiers !== null && !legacyRankedTiers.includes(t)
        if (isLegacyVrac) {
          return inTier.map(i => ({ id: i.entryId, tier: t, position: 1, note: i.note ?? undefined }))
        }
        // Compress stored positions to a local 1-based scale, preserving ties.
        // Items that share the same stored position (new model) keep sharing;
        // legacy distinct positions become 1, 2, 3…
        let localRank = 0
        let prevStored: number | null = null
        return inTier.map(i => {
          const stored = i.position ?? null
          if (stored === null) {
            localRank = Math.max(localRank, 1)
          } else if (stored !== prevStored) {
            localRank += 1
            prevStored = stored
          }
          return { id: i.entryId, tier: t, position: localRank, note: i.note ?? undefined }
        })
      })
    : []
  // All active tiers are "ranked" in the new model. We still pass this to the
  // editor so its internal shape matches the save path and the state's
  // snapshot comparison stays stable.
  const initRankedTiers = TIERS.filter(t => initTierItems.some(i => i.tier === t))

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
        items={entries.map(e => ({ id: e.id, label: pickTitle(e, lang), suffix: e.year?.toString(), cover: e.cover, year: e.year, tierCount: e.tierCount, score: e.score, kind: e.kind }))}
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
