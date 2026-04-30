'use client'

import React, { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { addEntry } from '@/app/actions/entries'
import { RankingEditor, type RankEditItem } from '@/app/components/RankingEditor'
import { getDict, type Dict } from '@/dictionaries/client'

type EntryItem = { id: string; title: string; year: number | null }

type ListItemData = {
  entryId: string
  position: number | null
  tier: string | null
  note: string | null
  entry: { id: string; title: string; year: number | null; cover: string | null }
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

  const myTierList = lists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  async function handleSave(tier: RankEditItem[], rankedTiers: string[]) {
    if (tier.length === 0) {
      if (myTierList) {
        console.log('[UserEntryListSection] saving empty ranking → deleting list', myTierList.id)
        await handleDelete()
      } else setIsEditing(false)
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
        for (const item of inTier) globalizedItems.push({ ...item, position: undefined })
      }
    }
    const updated = await saveUserEntryLists(
      topicSlug,
      [],
      globalizedItems.map(i => ({ entryId: i.id, tier: i.tier, position: i.position, note: i.note })),
      rankedTiers
    )
    onListsChange([...lists.filter(l => l.userId !== currentUserId), ...updated])
    setIsEditing(false)
  }

  async function handleDelete() {
    await saveUserEntryLists(topicSlug, [], [], [])
    onListsChange(lists.filter(l => l.userId !== currentUserId))
    setIsEditing(false)
  }

  if (!isEditing) return null

  const initTierItems = myTierList
    ? myTierList.items
        .filter(i => i.tier && TIERS.includes(i.tier))
        .map(i => ({ id: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined, note: i.note ?? undefined }))
    : []
  const initRankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)

  return (
    <div style={{ paddingBottom: 28 }}>
      <RankingEditor
        items={entries.map(e => ({ id: e.id, label: e.title, suffix: e.year?.toString() }))}
        initialTierItems={initTierItems}
        initialRankedTiers={initRankedTiers}
        hasExisting={!!myTierList}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        onDelete={myTierList ? handleDelete : undefined}
        t={t}
        addFormAction={addFormAction}
        addPending={addPending}
        addError={addState?.error ?? null}
        addEntryLabel={tRank.addEntryTitle}
      />
    </div>
  )
}
