'use client'

import React, { use, useState, useEffect, useRef, useContext, createContext, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { saveGuestServerList } from '@/app/actions/guestServerSave'
import { fetchAllRankEntries } from '@/app/actions/rankEntries'
import { type UserEntryListData } from './UserEntryListSection'
import type { RankEntry, CommunityEntries } from '@/lib/communityRankData'
import { combinedScore } from '@/lib/communityRankScore'
import { pickTitle } from '@/lib/i18n'
import {
  GUEST_USER_ID,
  hydrateGuestList,
  saveGuestEntryLists,
} from '@/lib/guestListAdapter'
import { getGuestUserId, setGuestUserId } from '@/lib/guestList'
import { trackEvent } from '@/lib/analytics'
import Link from 'next/link'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
// TB darker green / BO brighter lime so the two greens read as distinct
// in the per-row distribution bar where they're adjacent stops.
const TIER_COLOR: Record<string, string> = {
  EX: '#3b82f6', TB: '#16a34a', BO: '#a3e635', AB: '#eab308', PA: '#f97316', IN: '#ef4444', MA: '#737373',
}
const TIER_COLOR_SOFT: Record<string, { bg: string; fg: string; border: string }> = {
  EX: { bg: '#eff6ff', fg: '#1e40af', border: '#dbeafe' },
  TB: { bg: '#f0fdf4', fg: '#166534', border: '#dcfce7' },
  BO: { bg: '#f7fee7', fg: '#4d7c0f', border: '#ecfccb' },
  AB: { bg: '#fefce8', fg: '#854d0e', border: '#fef9c3' },
  PA: { bg: '#fff7ed', fg: '#9a3412', border: '#ffedd5' },
  IN: { bg: '#fef2f2', fg: '#991b1b', border: '#fee2e2' },
  MA: { bg: '#fafafa', fg: '#525252', border: '#e5e5e5' },
}

const MEDAL: Record<number, { bg: string; fg: string; border: string }> = {
  1: { bg: '#fef3c7', fg: '#b45309', border: '#fcd34d' },
  2: { bg: '#f1f5f9', fg: '#475569', border: '#cbd5e1' },
  3: { bg: '#ffedd5', fg: '#9a3412', border: '#fdba74' },
}

type SortMode = 'combined' | 'tier' | 'rank' | 'favorite' | 'popular'

// null = all decades; number = the decade start year (e.g. 2020 for the 2020s).
type DecadeFilter = number | null

const RankSortContext = createContext<{
  sortMode: SortMode
  setSortMode: (m: SortMode) => void
  decade: DecadeFilter
  setDecade: (d: DecadeFilter) => void
} | null>(null)

export function RankSortProvider({ children }: { children: React.ReactNode }) {
  const [sortMode, setSortMode] = useState<SortMode>('combined')
  const [decade, setDecade] = useState<DecadeFilter>(null)
  return (
    <RankSortContext.Provider value={{ sortMode, setSortMode, decade, setDecade }}>
      {children}
    </RankSortContext.Provider>
  )
}

type Entry = RankEntry

type ListItemData = {
  entryId: string
  position: number | null
  tier: string | null
  note: string | null
  entry: { id: string; title: string; year: number | null; cover: string | null }
}

export type PersonalRankData = {
  userLists: UserEntryListData[]
  currentUserId: string | null
  isLoggedIn: boolean
}

// Describes where in a tier a quick-add drop lands: either join an existing
// rank group (tie) or create a new rank at that slot.
export type QuickAddSlot =
  | { kind: 'join'; rank: number }
  | { kind: 'insert'; beforeRank: number | null }

function QuickAddPanel({
  entry,
  myTierList,
  onAdd,
  onRemove,
  onClose,
}: {
  entry: Entry
  myTierList: UserEntryListData | null
  onAdd: (tier: string, slot: QuickAddSlot) => Promise<void>
  onRemove: () => Promise<void>
  onClose: () => void
}) {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const currentTierOfEntry = myTierList?.items.find(i => i.entryId === entry.id)?.tier ?? null

  const [selectedTier, setSelectedTier] = useState<string | null>(currentTierOfEntry)
  const [selectedSlot, setSelectedSlot] = useState<QuickAddSlot | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Build rank groups for the selected tier (excluding the entry being
  // added/moved) so the picker can offer "same rank as X" or "new rank
  // between #N and #N+1".
  const rankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
  const groups: Array<{ rank: number; items: ListItemData[] }> = (() => {
    if (!selectedTier) return []
    const items = (myTierList?.items ?? [])
      .filter(i => i.tier === selectedTier && i.entryId !== entry.id)
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    const isLegacyVrac = !rankedTiers.includes(selectedTier)
    const gs: Array<{ rank: number; items: ListItemData[] }> = []
    if (isLegacyVrac) {
      if (items.length > 0) gs.push({ rank: 1, items })
    } else {
      let prevStored: number | null = null
      for (const it of items) {
        const stored = it.position ?? null
        if (stored !== null && stored === prevStored && gs.length > 0) {
          gs[gs.length - 1].items.push(it)
        } else {
          gs.push({ rank: gs.length + 1, items: [it] })
        }
        prevStored = stored
      }
    }
    return gs
  })()

  // Default slot when the user selects a tier: append a new rank at the end.
  function pickDefaultSlot(tier: string): QuickAddSlot {
    const prevItems = (myTierList?.items ?? [])
      .filter(i => i.tier === tier && i.entryId !== entry.id)
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    if (prevItems.length === 0) return { kind: 'insert', beforeRank: null }
    return { kind: 'insert', beforeRank: null }
  }

  async function handleConfirm() {
    if (!selectedTier) return
    const slot = selectedSlot ?? pickDefaultSlot(selectedTier)
    setIsPending(true)
    await onAdd(selectedTier, slot)
  }

  function slotLabel(slot: QuickAddSlot): string {
    if (slot.kind === 'join') {
      const g = groups.find(x => x.rank === slot.rank)
      const titles = g?.items.slice(0, 2).map(x => pickTitle(x.entry, lang)).join(', ')
      return `= Même rang #${slot.rank} que ${titles}${(g?.items.length ?? 0) > 2 ? '…' : ''}`
    }
    if (slot.beforeRank === null) {
      const nextR = (groups[groups.length - 1]?.rank ?? 0) + 1
      return groups.length === 0 ? 'Premier rang (#1)' : `Nouveau rang en dernier (#${nextR})`
    }
    if (slot.beforeRank === 1) return 'Nouveau rang en tête (#1)'
    return `Nouveau rang avant #${slot.beforeRank}`
  }

  const slotOptions: QuickAddSlot[] = (() => {
    if (!selectedTier) return []
    if (groups.length === 0) return [{ kind: 'insert', beforeRank: null }]
    const options: QuickAddSlot[] = [{ kind: 'insert', beforeRank: groups[0].rank }]
    for (let i = 0; i < groups.length; i++) {
      options.push({ kind: 'join', rank: groups[i].rank })
      const nextRank = groups[i + 1]?.rank ?? null
      options.push({ kind: 'insert', beforeRank: nextRank })
    }
    return options
  })()

  function slotKey(slot: QuickAddSlot): string {
    return slot.kind === 'join' ? `j-${slot.rank}` : `i-${slot.beforeRank ?? 'end'}`
  }

  return (
    <div className="rank-quick-add" style={{ padding: '14px 20px', background: 'var(--bg-subtle)' }}>
      <div style={{ fontSize: 12, color: 'var(--fg-5)', marginBottom: 10 }}>
        Ajouter à ma liste : <span style={{ color: 'var(--fg-2)', fontWeight: 600 }}>{pickTitle(entry, lang)}</span>
        {currentTierOfEntry && (
          <span style={{ marginLeft: 8, fontSize: 11, color: TIER_COLOR[currentTierOfEntry], fontStyle: 'italic' }}>
            (actuellement en {TIER_LABEL[currentTierOfEntry]})
          </span>
        )}
      </div>

      {/* Tier selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TIERS.map(tier => {
          const c = TIER_COLOR[tier]
          const isSelected = selectedTier === tier
          return (
            <button
              key={tier}
              onClick={() => { setSelectedTier(tier); setSelectedSlot(null) }}
              style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 11,
                border: `1px solid ${isSelected ? c : c + '55'}`,
                background: isSelected ? `${c}22` : 'none',
                color: c,
                outline: isSelected ? `2px solid ${c}44` : 'none',
                transition: 'all .1s',
              }}
            >
              {TIER_LABEL[tier]}
            </button>
          )
        })}
      </div>

      {/* Rank-slot picker */}
      {selectedTier && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-6)', marginBottom: 4 }}>
            Rang dans {TIER_LABEL[selectedTier]} :
          </div>
          {slotOptions.map(slot => {
            const key = slotKey(slot)
            const effectiveSelected = selectedSlot ? slotKey(selectedSlot) : slotKey(pickDefaultSlot(selectedTier))
            const checked = key === effectiveSelected
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: checked ? 'var(--fg-2)' : 'var(--fg-6)', padding: '3px 0' }}>
                <input type="radio" name="pos" checked={checked} onChange={() => setSelectedSlot(slot)} style={{ accentColor: TIER_COLOR[selectedTier] }} />
                {slotLabel(slot)}
              </label>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <button
          onClick={handleConfirm}
          disabled={!selectedTier || isPending}
          style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontFamily: 'inherit', cursor: selectedTier && !isPending ? 'pointer' : 'not-allowed', opacity: selectedTier && !isPending ? 1 : 0.5 }}
        >
          {isPending ? 'Ajout…' : currentTierOfEntry ? 'Déplacer' : 'Ajouter'}
        </button>
        <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-6)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
          Annuler
        </button>
        {currentTierOfEntry && (
          <button
            onClick={async () => { setIsPending(true); await onRemove() }}
            disabled={isPending}
            title="Retirer ce film de ma liste"
            style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #e0a0a0', background: 'none', color: '#c0392b', fontSize: 12, fontFamily: 'inherit', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.5 : 1 }}
          >
            Supprimer de ma liste
          </button>
        )}
        <Link
          href={`/${lang}/rank/${slug}/edit`}
          style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-5)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
        >
          Voir ma liste →
        </Link>
      </div>
    </div>
  )
}

function majorityTier(distribution: Record<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const tier of TIERS) {
    const c = distribution[tier] ?? 0
    if (c > bestCount) { best = tier; bestCount = c }
  }
  return best
}

const TIER_VALUE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }
const TIER_BY_VALUE: Record<number, string> = { 7: 'EX', 6: 'TB', 5: 'BO', 4: 'AB', 3: 'PA', 2: 'IN', 1: 'MA' }

type UserRankContrib = {
  entryId: string
  tier: string
  localRank: number
  // Global rank (dense) across all tiers — tiers are stacked top-to-bottom,
  // so group counts carry over: EX #1, #2, then TB's first group becomes #3.
  globalRank: number
  // Average of the positions the tie group occupies within its tier (1-based).
  localFracRank: number
  // Same, but across the whole list (adds the tier offset).
  globalFracRank: number
}

// Normalize a user's list into rank-group contributions, mirroring the
// aggregation in lib/communityRankData.ts. Keeps optimistic client updates
// in sync with the server's computed avgRank / favoriteCount.
function enrichUserList(items: ListItemData[], rankedTiers: string[]): UserRankContrib[] {
  const out: UserRankContrib[] = []
  let runningGlobalItems = 0
  let runningGlobalGroups = 0
  for (const tier of TIERS) {
    const inTier = items
      .filter(i => i.tier === tier)
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    if (inTier.length === 0) continue
    const isLegacyVrac = !rankedTiers.includes(tier)
    const groups: ListItemData[][] = []
    if (isLegacyVrac) {
      groups.push(inTier)
    } else {
      let prevStored: number | null = null
      for (const i of inTier) {
        const stored = i.position ?? null
        if (stored !== null && stored === prevStored && groups.length > 0) {
          groups[groups.length - 1].push(i)
        } else {
          groups.push([i])
        }
        prevStored = stored
      }
    }
    let posInTier = 1
    groups.forEach((g, gIdx) => {
      const localRank = gIdx + 1
      const globalRank = runningGlobalGroups + gIdx + 1
      const localOccupied: number[] = []
      const globalOccupied: number[] = []
      for (let i = 0; i < g.length; i++) {
        localOccupied.push(posInTier)
        globalOccupied.push(runningGlobalItems + posInTier)
        posInTier += 1
      }
      const localFracRank = localOccupied.reduce((s, p) => s + p, 0) / localOccupied.length
      const globalFracRank = globalOccupied.reduce((s, p) => s + p, 0) / globalOccupied.length
      for (const it of g) out.push({ entryId: it.entryId, tier, localRank, globalRank, localFracRank, globalFracRank })
    })
    runningGlobalItems += inTier.length
    runningGlobalGroups += groups.length
  }
  return out
}

// First entry of the top rank group in the top-most non-empty tier.
function findUserFavorite(contribs: UserRankContrib[]): string | null {
  for (const tier of TIERS) {
    const first = contribs.find(c => c.tier === tier && c.localRank === 1)
    if (first) return first.entryId
  }
  return null
}

// Optimistic update of the community entries to reflect a change in the
// current user's list — re-applies the same aggregation as
// getCommunityData but incrementally (no DB call).
function applyMyListChange(
  entries: Entry[],
  prevItems: ListItemData[],
  newItems: ListItemData[],
  prevRanked: string[],
  newRanked: string[],
): Entry[] {
  const prevContribs = enrichUserList(prevItems, prevRanked)
  const newContribs = enrichUserList(newItems, newRanked)
  const prevBy = new Map(prevContribs.map(c => [c.entryId, c]))
  const newBy = new Map(newContribs.map(c => [c.entryId, c]))

  const prevTiers = new Map<string, string | null>()
  for (const i of prevItems) prevTiers.set(i.entryId, i.tier ?? null)
  const newTiers = new Map<string, string | null>()
  for (const i of newItems) newTiers.set(i.entryId, i.tier ?? null)

  const prevFav = findUserFavorite(prevContribs)
  const newFav = findUserFavorite(newContribs)

  const affected = new Set<string>()
  for (const id of prevBy.keys()) affected.add(id)
  for (const id of newBy.keys()) affected.add(id)
  for (const id of prevTiers.keys()) affected.add(id)
  for (const id of newTiers.keys()) affected.add(id)
  if (prevFav) affected.add(prevFav)
  if (newFav) affected.add(newFav)

  return entries.map(e => {
    if (!affected.has(e.id)) return e

    const prevT = prevTiers.get(e.id) ?? null
    const nextT = newTiers.get(e.id) ?? null

    // tierDistribution + tierCount + avgTierScore
    const newDist: Record<string, number> = { ...e.tierDistribution }
    if (prevT) newDist[prevT] = Math.max(0, (newDist[prevT] ?? 0) - 1)
    if (nextT) newDist[nextT] = (newDist[nextT] ?? 0) + 1

    let totalScore = 0
    let totalCount = 0
    for (const [t, c] of Object.entries(newDist)) {
      const v = TIER_VALUE[t]
      if (v === undefined) continue
      totalScore += v * c
      totalCount += c
    }

    // avgRank + rankCount via geometric mean (sumLog = log(avgRank) × rankCount).
    // Both prev and new contributions use fractional global rank from the
    // tie-aware aggregation above.
    let sumLog = e.avgRank !== null && e.rankCount > 0 ? Math.log(e.avgRank) * e.rankCount : 0
    let newRankCount = e.rankCount
    const prevC = prevBy.get(e.id)
    const nextC = newBy.get(e.id)
    if (prevC) { sumLog -= Math.log(prevC.globalFracRank); newRankCount -= 1 }
    if (nextC) { sumLog += Math.log(nextC.globalFracRank); newRankCount += 1 }
    const newAvgRank = newRankCount > 0 ? Math.exp(sumLog / newRankCount) : null

    // favoriteCount delta
    let favCount = e.favoriteCount
    if (prevFav === e.id) favCount = Math.max(0, favCount - 1)
    if (newFav === e.id) favCount += 1

    // Keep rankPositions in sync with the user's optimistic change so the
    // anonymised distribution popover reflects what they just did.
    let newPositions = e.rankPositions
    if (prevC || nextC) {
      newPositions = [...e.rankPositions]
      if (prevC) {
        const idx = newPositions.findIndex(p => Math.abs(p - prevC.globalFracRank) < 1e-9)
        if (idx !== -1) newPositions.splice(idx, 1)
      }
      if (nextC) newPositions.push(nextC.globalFracRank)
      newPositions.sort((a, b) => a - b)
    }

    return {
      ...e,
      tierDistribution: newDist,
      tierCount: totalCount,
      avgTierScore: totalCount > 0 ? totalScore / totalCount : null,
      avgRank: newAvgRank,
      rankCount: newRankCount,
      favoriteCount: favCount,
      rankPositions: newPositions,
    }
  })
}

// Build a short, plain-French summary of how the votes are distributed.
// Drives the descriptive line under the per-row distribution bar.
function describeDistribution(
  distribution: Record<string, number>,
  totalVotes: number,
): string {
  if (totalVotes === 0) return ''
  const counts = TIERS
    .map(t => ({ tier: t, count: distribution[t] ?? 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
  if (totalVotes === 1) {
    return counts[0].tier === 'EX' ? '1 avis · culte mais confidentiel' : '1 avis'
  }
  if (counts.length === 1) return `${totalVotes} avis · unanime`
  if (counts.length === 2 && totalVotes <= 6) {
    return `${totalVotes} avis · ${counts[0].count}× ${TIER_LABEL[counts[0].tier]}, ${counts[1].count}× ${TIER_LABEL[counts[1].tier]}`
  }
  if (counts.length >= 3) {
    const dominantPct = counts[0].count / totalVotes
    if (dominantPct < 0.5) return `${totalVotes} avis · opinions partagées`
  }
  const dominantPct = counts[0].count / totalVotes
  if (dominantPct >= 0.65) return `${totalVotes} avis · majoritairement ${TIER_LABEL[counts[0].tier]}`
  return `${totalVotes} avis · consensus positif`
}

// Median of the vote values (1..7). More robust to outliers than the mean,
// and avoids the modal tie-break that would surface "Excellent" on a 2-2
// split between EX and TB.
function medianTierValue(distribution: Record<string, number>): number | null {
  const values: number[] = []
  for (const tier of TIERS) {
    const count = distribution[tier] ?? 0
    const v = TIER_VALUE[tier]
    for (let i = 0; i < count; i++) values.push(v)
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  return values.length % 2 === 0
    ? Math.round((values[mid - 1] + values[mid]) / 2)
    : values[mid]
}

function buildTierGradient(distribution: Record<string, number>, total: number): string | null {
  if (total === 0) return null
  const visible = TIERS.filter(t => (distribution[t] ?? 0) > 0)
  if (visible.length === 0) return null
  const stops: string[] = []
  let cum = 0
  for (let i = 0; i < visible.length; i++) {
    const tier = visible[i]
    const count = distribution[tier] ?? 0
    const pct = (count / total) * 100
    const isFirst = i === 0
    const isLast = i === visible.length - 1
    // Adaptive blend so even tiny slices stay visible
    const blend = Math.min(1.5, pct / 3)
    const solidStart = isFirst ? cum : cum + blend
    const solidEnd = isLast ? cum + pct : cum + pct - blend
    stops.push(`${TIER_COLOR[tier]} ${solidStart.toFixed(2)}%`)
    stops.push(`${TIER_COLOR[tier]} ${solidEnd.toFixed(2)}%`)
    cum += pct
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export function MentionLegend({ lang }: { lang: 'fr' | 'en' }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = lang === 'fr' ? 'Échelle des mentions' : 'Rating scale'

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 12,
          background: open ? 'var(--bg-subtle)' : 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--fg-5)', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden style={{ fontSize: 11, opacity: 0.7 }}>ⓘ</span>
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 30,
            background: 'var(--bg-card)',
            borderRadius: 12,
            padding: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 12px 32px rgba(0,0,0,.12)',
            display: 'flex',
            gap: 6,
            width: 'min(620px, calc(100vw - 48px))',
          }}
        >
          {TIERS.map(tier => {
            const c = TIER_COLOR_SOFT[tier]
            return (
              <div
                key={tier}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  color: c.fg,
                }}
              >
                {TIER_LABEL[tier]}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SORT_OPTIONS: { mode: SortMode; label: string; tip: string; labelEn?: string; tipEn?: string }[] = [
  { mode: 'combined', label: 'Score', tip: 'Mention ajustée + bonus de rang', labelEn: 'Score', tipEn: 'Adjusted mention + rank bonus' },
  { mode: 'tier', label: 'Mention', tip: 'Moyenne des mentions sur 7', labelEn: 'Mention', tipEn: 'Average of mentions on 7' },
  { mode: 'rank', label: 'Rang moyen', tip: 'Position moyenne dans les classements perso', labelEn: 'Avg rank', tipEn: 'Average position across personal rankings' },
  { mode: 'favorite', label: 'Favoris', tip: 'Nombre de fois en #1 d’un classement', labelEn: 'Favourites', tipEn: 'Times ranked #1 in a personal list' },
  { mode: 'popular', label: 'Avis', tip: 'Nombre total de mentions', labelEn: 'Ratings', tipEn: 'Total number of ratings' },
]

function DecadeDropdown({
  decadeCounts,
  decade,
  setDecade,
  isFr,
}: {
  decadeCounts: Array<{ decade: number; count: number }>
  decade: number | null
  setDecade: (d: number | null) => void
  isFr: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const total = decadeCounts.reduce((s, d) => s + d.count, 0)
  const active = decade !== null

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={active ? (isFr ? `Filtré : années ${decade}` : `Filtered: ${decade}s`) : (isFr ? 'Filtrer par décennie' : 'Filter by decade')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          border: `1px solid ${active ? 'var(--accent-fg)' : 'var(--border)'}`,
          background: active ? 'var(--accent-faint)' : (open ? 'var(--bg-subtle)' : 'transparent'),
          color: active ? 'var(--accent-fg)' : 'var(--fg-5)',
          fontWeight: active ? 700 : 500,
          fontSize: 12.5,
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}
      >
        <span>{isFr ? 'Décennie' : 'Decade'}{active ? ` : ${decade}s` : ''}</span>
        <span aria-hidden style={{ fontSize: 14, opacity: 0.75, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={isFr ? 'Filtrer par décennie' : 'Filter by decade'}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            background: 'var(--bg-card)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: '0 12px 32px rgba(0,0,0,.12)',
            minWidth: 220,
            padding: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            maxHeight: 340,
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            role="option"
            aria-selected={decade === null}
            onClick={() => { setDecade(null); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '7px 12px', borderRadius: 6,
              border: 'none', background: decade === null ? 'var(--bg-subtle)' : 'transparent',
              color: decade === null ? 'var(--fg-2)' : 'var(--fg-3)',
              fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: decade === null ? 600 : 500,
              textAlign: 'left',
            }}
          >
            <span>{isFr ? 'Toutes les décennies' : 'All decades'}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          </button>
          <div aria-hidden style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />
          {decadeCounts.map(({ decade: d, count }) => {
            const active = decade === d
            return (
              <button
                key={d}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { setDecade(active ? null : d); setOpen(false) }}
                title={isFr ? `${d} à ${d + 9}` : `${d} to ${d + 9}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '7px 12px', borderRadius: 6,
                  border: 'none', background: active ? 'var(--bg-subtle)' : 'transparent',
                  color: active ? 'var(--fg-2)' : 'var(--fg-3)',
                  fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                  fontWeight: active ? 600 : 500,
                  textAlign: 'left',
                }}
              >
                <span>{d}s</span>
                <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RankToolbar({
  decadeCounts,
}: {
  decadeCounts: Array<{ decade: number; count: number }>
}) {
  const { lang } = useParams() as { lang: string }
  const isFr = lang === 'fr'
  const ctx = useContext(RankSortContext)
  const sortMode = ctx?.sortMode ?? 'combined'
  const setSortMode = ctx?.setSortMode ?? (() => {})
  const decade = ctx?.decade ?? null
  const setDecade = ctx?.setDecade ?? (() => {})

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--fg-4)' : 'var(--border)'}`,
    background: active ? 'var(--bg-subtle)' : 'transparent',
    color: active ? 'var(--fg-2)' : 'var(--fg-5)',
    fontWeight: active ? 600 : 500,
    fontSize: 12.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
  })

  const groupLabelStyle: React.CSSProperties = {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
    color: 'var(--fg-6)', fontWeight: 600, marginRight: 4,
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
        padding: '12px 0 14px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 4,
      }}
    >
      <span style={groupLabelStyle}>{isFr ? 'Trier' : 'Sort'}</span>
      {SORT_OPTIONS.map(opt => {
        const label = isFr ? opt.label : (opt.labelEn ?? opt.label)
        const tip = isFr ? opt.tip : (opt.tipEn ?? opt.tip)
        return (
          <button
            key={opt.mode}
            type="button"
            title={tip}
            onClick={() => setSortMode(opt.mode)}
            style={pillStyle(sortMode === opt.mode)}
          >
            {label}
          </button>
        )
      })}
      {decadeCounts.length > 0 && (
        <>
          <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 4px' }} />
          <DecadeDropdown decadeCounts={decadeCounts} decade={decade} setDecade={setDecade} isFr={isFr} />
        </>
      )}
    </div>
  )
}

function TableHeader() {
  const ctx = useContext(RankSortContext)
  const sortMode = ctx?.sortMode ?? 'combined'
  const setSortMode = ctx?.setSortMode ?? (() => {})

  const headerBtnStyle = (mode: SortMode): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textTransform: 'inherit',
    letterSpacing: 'inherit',
    color: sortMode === mode ? 'var(--fg-3)' : 'var(--fg-6)',
    fontWeight: sortMode === mode ? 700 : 600,
    cursor: 'pointer',
  })
  const arrow = (mode: SortMode) =>
    sortMode === mode ? <span aria-hidden style={{ fontSize: 10, opacity: 0.85 }}>↓</span> : null
  const Info = ({ tip, label }: { tip: string; label: string }) => (
    <span
      title={tip}
      onClick={e => e.stopPropagation()}
      aria-label={label}
      style={{ cursor: 'help', opacity: 0.55, fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
    >
      ⓘ
    </span>
  )

  return (
    <div className="rank-header" style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--fg-6)', fontWeight: 600,
    }}>
      <span className="col-rank" style={{ textAlign: 'center' }}>#</span>
      <span className="col-poster" />
      <span className="col-title">Titre</span>
      <div className="col-metrics">
        <button
          type="button"
          onClick={() => setSortMode('combined')}
          className="col-score"
          style={{ ...headerBtnStyle('combined'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          Score
          {arrow('combined')}
          <Info
            label="Comment ce score est calculé"
            tip={`Score = mention ajustée × 4 + bonus de rang.\n\n• Mention ajustée : moyenne des avis sur 7, lissée vers « Assez bien » (4) tant qu'il y a peu de votes — un seul "Excellent" pèse moins qu'un consensus à dix avis.\n\n• Bonus de rang : récompense logarithmique des hautes positions (#1 vaut bien plus que #10), pondérée par le nombre de classements.\n\nLe tout favorise les films à la fois bien notés et bien classés.`}
          />
        </button>
        <button
          type="button"
          onClick={() => setSortMode('tier')}
          className="col-mention"
          style={{ ...headerBtnStyle('tier'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          Mention communauté
          {arrow('tier')}
          <Info
            label="Comment lire la mention"
            tip="La pastille reprend la mention médiane des votes (plus robuste aux outliers que la moyenne). La barre montre la répartition des votes par tier."
          />
        </button>
        <button
          type="button"
          onClick={() => setSortMode('rank')}
          className="col-avg"
          style={{ ...headerBtnStyle('rank'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          Rang moyen
          {arrow('rank')}
          <Info
            label="Comment ce rang est calculé"
            tip="Moyenne géométrique des positions de chaque classement personnel — un vote #1 + un vote #100 donne 10 (vs 50 en moyenne arithmétique). Plus le rang est petit, mieux c'est."
          />
        </button>
        <span className="col-mynote" style={{ textAlign: 'center' }}>Ma mention</span>
      </div>
    </div>
  )
}

function EntryRow({ entry, rank, myTier, myRank, myRankFractional, isOpen, onAdd }: {
  entry: Entry
  rank: number
  myTier: string | null
  // User's chosen integer rank within their tier (ties share the same number).
  myRank: number | null
  // "Official" fractional rank — shown as a smaller hint when the user is
  // tied with others at the same integer rank.
  myRankFractional: number | null
  isOpen: boolean
  onAdd: () => void
}) {
  const [positionsOpen, setPositionsOpen] = useState(false)
  const positionsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!positionsOpen) return
    const onPointer = (ev: MouseEvent) => {
      if (positionsRef.current && !positionsRef.current.contains(ev.target as Node)) setPositionsOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setPositionsOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [positionsOpen])
  const { lang } = useParams() as { lang: string }
  const displayTitle = pickTitle(entry, lang)
  const isTop3 = rank <= 3
  const myTierColor = myTier ? TIER_COLOR[myTier] : null
  const totalVotes = Object.values(entry.tierDistribution).reduce((s, n) => s + n, 0)
  const medianVal = medianTierValue(entry.tierDistribution)
  const mention = medianVal !== null ? TIER_BY_VALUE[medianVal] : null
  const tierGradient = buildTierGradient(entry.tierDistribution, totalVotes)

  return (
    <div className="rank-row" style={{ cursor: 'default', background: isOpen ? 'var(--bg-subtle)' : undefined }}>
      {/* Rank */}
      {isTop3 ? (
        <div className="col-rank" style={{ display: 'flex', justifyContent: 'center' }}>
          <span
            aria-label={`Rang ${rank}`}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: '50%',
              background: MEDAL[rank].bg,
              border: `1px solid ${MEDAL[rank].border}`,
              color: MEDAL[rank].fg,
              fontFamily: "'Fraunces', serif",
              fontWeight: 700, fontSize: 15, letterSpacing: -0.3,
              lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rank}
          </span>
        </div>
      ) : (
        <span className="col-rank" style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 14,
          fontWeight: 400,
          color: 'var(--fg-5)',
          textAlign: 'center', lineHeight: 1,
        }}>{rank}</span>
      )}

      {/* Poster */}
      {entry.cover
        ? <img className="col-poster" src={entry.cover} alt={displayTitle} loading="lazy" style={{ width: 48, height: 72, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)' }} />
        : <div className="col-poster" style={{ width: 48, height: 72, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }} />
      }

      {/* Title */}
      <div className="col-title" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{displayTitle}</span>
          {entry.kind === 'SAGA' && (
            <span title="Collection — série de films regroupés" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 3, background: 'var(--accent-faint)', color: 'var(--accent-fg)', border: '1px solid var(--accent-muted)', flexShrink: 0 }}>
              Collection
            </span>
          )}
        </div>
        {entry.kind !== 'SAGA' && entry.year && <div style={{ fontSize: 12, color: 'var(--fg-5)', marginTop: 1 }}>{entry.year}</div>}
      </div>

      <div className="col-metrics">
        {/* Score combiné */}
        <div className="col-score" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {(() => {
            const score = combinedScore(entry)
            return (
              <span style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: -0.4,
                color: 'var(--fg-3)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}>
                {score.toFixed(1)}
              </span>
            )
          })()}
        </div>

        {/* Mention */}
        <div className="col-mention" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          {mention ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px 2px 7px',
                  borderRadius: 11,
                  fontSize: 12, fontWeight: 600,
                  background: TIER_COLOR_SOFT[mention].bg,
                  color: TIER_COLOR_SOFT[mention].fg,
                  border: `1px solid ${TIER_COLOR_SOFT[mention].border}`,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: TIER_COLOR[mention], flexShrink: 0 }} />
                  {TIER_LABEL[mention]}
                </span>
              </div>
              <div>
                <div
                  title={`${describeDistribution(entry.tierDistribution, totalVotes)}\n${TIERS.filter(t => entry.tierDistribution[t]).map(t => `${TIER_LABEL[t]} : ${entry.tierDistribution[t]}`).join(' · ')}`}
                  style={{
                    display: 'flex',
                    height: 4,
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'var(--bg-subtle)',
                  }}
                >
                  {TIERS.map(tier => {
                    const count = entry.tierDistribution[tier] ?? 0
                    if (count === 0) return null
                    const pct = (count / totalVotes) * 100
                    return <span key={tier} style={{ width: `${pct}%`, background: TIER_COLOR[tier] }} />
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-6)', marginTop: 4 }}>
                  {totalVotes} avis
                </div>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--fg-7)', textAlign: 'center' }}>—</span>
          )}
        </div>

        {/* Rang moyen */}
        <div className="col-avg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative' }}>
          {entry.avgRank !== null ? (
            <>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                #{entry.avgRank.toFixed(1)}
              </span>
              <button
                onClick={ev => { ev.stopPropagation(); setPositionsOpen(o => !o) }}
                title="Voir le détail anonyme des classements"
                style={{ fontSize: 11, color: positionsOpen ? 'var(--fg-3)' : 'var(--fg-6)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}
              >
                {entry.rankCount} classement{entry.rankCount > 1 ? 's' : ''}
              </button>
              {positionsOpen && (
                <div
                  ref={positionsRef}
                  onClick={ev => ev.stopPropagation()}
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 40, minWidth: 220, maxWidth: 320,
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                    boxShadow: '0 10px 32px rgba(0,0,0,.18)',
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-6)', fontWeight: 600, marginBottom: 6 }}>
                    Rangs individuels (anonymes)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {entry.rankPositions.map((p, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 30, padding: '2px 7px', borderRadius: 999,
                        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                        fontFamily: "'Fraunces', serif", fontSize: 12, fontWeight: 700, color: 'var(--fg-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        #{Number.isInteger(p) ? p : p.toFixed(1)}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-6)', lineHeight: 1.4 }}>
                    Moyenne géométrique : <strong style={{ color: 'var(--fg-3)' }}>#{entry.avgRank.toFixed(1)}</strong>
                  </div>
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--fg-7)' }}>—</span>
          )}
        </div>

        {/* Ma note (cliquable : modifier/ajouter) — accessible aux invités via localStorage */}
        {(
          <button
            onClick={onAdd}
            title={myTier ? 'Modifier ma note' : 'Noter ce film'}
            className="col-mynote"
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              padding: '4px 6px', minHeight: 32, borderRadius: 7, cursor: 'pointer',
              background: isOpen ? 'var(--bg-subtle)' : 'transparent',
              border: `1px solid ${isOpen ? 'var(--fg-3)' : 'transparent'}`,
              fontFamily: 'inherit',
            }}
          >
            {myTier ? (() => {
              const myVal = TIER_VALUE[myTier]
              const commVal = mention !== null ? TIER_VALUE[mention] : null
              const diff = commVal !== null ? myVal - commVal : 0
              const agrees = commVal !== null && diff === 0

              return (
                <>
                  {agrees ? (
                    <span
                      title="Même avis que la communauté"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, color: 'var(--fg-6)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: 11, color: 'var(--fg-7)', fontWeight: 600 }}>✓</span>
                      {TIER_LABEL[myTier]}
                    </span>
                  ) : (
                    <span
                      title={
                        commVal === null
                          ? undefined
                          : diff > 0
                            ? `${Math.abs(diff)} tier au-dessus de la communauté`
                            : `${Math.abs(diff)} tier en-dessous de la communauté`
                      }
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '2px 8px 2px 7px',
                        borderRadius: 11,
                        fontSize: 12, fontWeight: 600,
                        background: TIER_COLOR_SOFT[myTier].bg,
                        color: TIER_COLOR_SOFT[myTier].fg,
                        border: `1px solid ${TIER_COLOR_SOFT[myTier].border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: TIER_COLOR[myTier], flexShrink: 0 }} />
                      {TIER_LABEL[myTier]}
                      {diff !== 0 && (
                        <span aria-hidden style={{ fontSize: 11, opacity: 0.75, fontWeight: 700, marginLeft: 1 }}>
                          {diff > 0 ? '↑' : '↓'}
                        </span>
                      )}
                    </span>
                  )}
                  {myRank != null && (
                    <span
                      title={
                        myRankFractional != null && Math.abs(myRankFractional - myRank) > 0.001
                          ? `Rang ${myRank} (officiellement ${myRankFractional.toFixed(1)}, ex-æquo)`
                          : 'Ma position dans mon classement personnel'
                      }
                      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, fontSize: 11, color: 'var(--fg-6)', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{myRank}<sup style={{ fontSize: 8, fontWeight: 400 }}>e</sup></span>
                      {myRankFractional != null && Math.abs(myRankFractional - myRank) > 0.001 && (
                        <span style={{ fontSize: 9, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                          ⌀{myRankFractional.toFixed(1)}
                        </span>
                      )}
                      <span>chez moi</span>
                    </span>
                  )}
                </>
              )
            })() : (
              <span style={{
                padding: '3px 9px',
                borderRadius: 11,
                color: 'var(--fg-6)',
                fontSize: 12,
                fontWeight: 500,
                background: isOpen ? 'var(--bg-subtle)' : 'transparent',
                border: isOpen ? '1px solid var(--fg-7)' : '1px solid transparent',
              }}>
                {isOpen ? '×' : '+ noter'}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// Resolves user lists promise and renders entry rows with user-specific data (my tier badges, quick add)
function UserAwareEntryList({
  personalDataPromise,
  entries,
  topicSlug,
  quickAddId,
  setQuickAddId,
  onApplyMyChange,
  rankScopeIds,
}: {
  personalDataPromise: Promise<PersonalRankData>
  entries: Entry[]
  topicSlug: string
  quickAddId: string | null
  setQuickAddId: (id: string | null) => void
  onApplyMyChange: (prev: ListItemData[], next: ListItemData[], prevRanked: string[], nextRanked: string[]) => void
  // When set, "my rank" is recomputed over this subset of entry ids
  // (e.g. only the entries in the current genre). Undefined on the main
  // page keeps the global rank behavior.
  rankScopeIds?: Set<string>
}) {
  const { userLists: initialLists, currentUserId, isLoggedIn } = use(personalDataPromise)
  const [lists, setLists] = useState(initialLists)
  const isGuest = !isLoggedIn
  const ownerId = currentUserId ?? GUEST_USER_ID

  // For guests, hydrate the local-only list from localStorage so my tier
  // badges + QuickAddPanel reflect the in-progress stash.
  useEffect(() => {
    if (!isGuest) return
    const guestList = hydrateGuestList(topicSlug, entries)
    if (guestList) setLists(prev => [...prev.filter(l => l.userId !== GUEST_USER_ID), guestList])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, topicSlug])

  const myTierList = lists.find(l => l.userId === ownerId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  async function persist(
    newItems: Array<{ entryId: string; tier?: string; position?: number; note?: string }>,
    rankedTiers: string[],
  ): Promise<UserEntryListData[]> {
    if (isGuest) {
      // localStorage first for instant local UI, then publish to the server
      // under the anonymous user so quick-add / remove from the ranking view
      // also contribute to the community ranking — same contract as the full
      // editor's handleSave in UserEntryListSection.
      const guestList = saveGuestEntryLists(topicSlug, entries, newItems, rankedTiers)
      const payload = newItems.map(i => ({
        entryId: i.entryId,
        tier: i.tier ?? null,
        position: i.position ?? null,
        note: i.note ?? null,
      }))
      const anonId = getGuestUserId()
      const res = await saveGuestServerList(topicSlug, anonId, payload, rankedTiers)
      if (res.ok) setGuestUserId(res.guestUserId)
      return guestList ? [guestList] : []
    }
    return saveUserEntryLists(topicSlug, [], newItems, rankedTiers, { revalidate: false })
  }

  // Normalize the current list into local-within-tier positions (preserving
  // existing ties), migrating legacy "vrac" tiers to a single tie group at
  // rank 1. Mirrors the hydration done in UserEntryListSection.
  function normalizeToLocal(
    items: ListItemData[],
    rankedTiers: string[],
  ): Array<{ entryId: string; tier: string; position: number; note?: string }> {
    const out: Array<{ entryId: string; tier: string; position: number; note?: string }> = []
    for (const t of TIERS) {
      const inT = items
        .filter(i => i.tier === t)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      if (inT.length === 0) continue
      const isLegacyVrac = !rankedTiers.includes(t)
      if (isLegacyVrac) {
        for (const i of inT) out.push({ entryId: i.entryId, tier: t, position: 1, note: i.note ?? undefined })
      } else {
        let localRank = 0
        let prevStored: number | null = null
        for (const i of inT) {
          const stored = i.position ?? null
          if (stored === null) {
            if (localRank === 0) localRank = 1
          } else if (stored !== prevStored) {
            localRank += 1
            prevStored = stored
          }
          out.push({ entryId: i.entryId, tier: t, position: localRank, note: i.note ?? undefined })
        }
      }
    }
    return out
  }

  // Compact a tier's ranks to a contiguous 1-based sequence, preserving ties.
  function compactTier(
    items: Array<{ entryId: string; tier: string; position: number; note?: string }>,
    tier: string,
  ) {
    const inT = items.filter(i => i.tier === tier).sort((a, b) => a.position - b.position)
    const map = new Map<number, number>()
    let next = 1
    for (const i of inT) {
      if (!map.has(i.position)) map.set(i.position, next++)
    }
    return items.map(i => i.tier === tier ? { ...i, position: map.get(i.position) ?? i.position } : i)
  }

  async function handleQuickAdd(entryId: string, tier: string, slot: QuickAddSlot) {
    const prevItems = myTierList?.items ?? []
    const prevRanked = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
    const existing = prevItems.find(i => i.entryId === entryId)
    const oldTier = existing?.tier ?? null

    // Normalize current list to local positions, excluding the moved entry.
    let working = normalizeToLocal(
      prevItems.filter(i => i.entryId !== entryId),
      prevRanked,
    )

    // Apply the slot op in the target tier.
    let newPosition: number
    if (slot.kind === 'join') {
      newPosition = slot.rank
    } else if (slot.beforeRank === null) {
      const maxR = working.filter(i => i.tier === tier).reduce((m, i) => Math.max(m, i.position), 0)
      newPosition = maxR + 1
    } else {
      newPosition = slot.beforeRank
      working = working.map(i => (i.tier === tier && i.position >= slot.beforeRank!)
        ? { ...i, position: i.position + 1 }
        : i)
    }

    working = [...working, { entryId, tier, position: newPosition, note: existing?.note ?? undefined }]
    working = compactTier(working, tier)
    if (oldTier && oldTier !== tier) working = compactTier(working, oldTier)

    const activeTiers = TIERS.filter(t => working.some(i => i.tier === t))
    const payload = working.map(i => ({ entryId: i.entryId, tier: i.tier, position: i.position, note: i.note }))

    const updated = await persist(payload, activeTiers)
    const newMy = updated.find(l => l.type === 'TIER' || l.type === 'BOTH') ?? null
    onApplyMyChange(
      prevItems,
      newMy?.items ?? [],
      prevRanked,
      (newMy?.rankedTiers ?? '').split(',').filter(Boolean),
    )
    setLists(prev => [...prev.filter(l => l.userId !== ownerId), ...updated])
    setQuickAddId(null)
    trackEvent({
      name: 'rank_save',
      props: { mode: isGuest ? 'guest' : 'logged_in', topic: topicSlug, items: payload.length, source: 'quick_add' },
    })
  }

  async function handleRemove(entryId: string) {
    if (!myTierList) return
    const prevRanked = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    const removed = myTierList.items.find(i => i.entryId === entryId)
    if (!removed) return
    const removedTier = removed.tier

    let working = normalizeToLocal(
      myTierList.items.filter(i => i.entryId !== entryId),
      prevRanked,
    )
    if (removedTier) working = compactTier(working, removedTier)

    const activeTiers = TIERS.filter(t => working.some(i => i.tier === t))
    const payload = working.map(i => ({ entryId: i.entryId, tier: i.tier, position: i.position, note: i.note }))

    const updated = await persist(payload, activeTiers)
    const newMy = updated.find(l => l.type === 'TIER' || l.type === 'BOTH') ?? null
    onApplyMyChange(
      myTierList.items,
      newMy?.items ?? [],
      prevRanked,
      (newMy?.rankedTiers ?? '').split(',').filter(Boolean),
    )
    setLists(prev => [...prev.filter(l => l.userId !== ownerId), ...updated])
    setQuickAddId(null)
    trackEvent({
      name: 'rank_save',
      props: { mode: isGuest ? 'guest' : 'logged_in', topic: topicSlug, items: payload.length, source: 'remove' },
    })
  }

  // Pre-compute per-entry rank info using the tie-aware aggregation so the
  // table rows can show both the integer rank (user's pick) and the
  // fractional "official" rank for tied groups.
  const myRankByEntry = (() => {
    const map = new Map<string, { globalRank: number; globalFracRank: number }>()
    if (!myTierList) return map
    const rankedTiers = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    const scopedItems = rankScopeIds
      ? myTierList.items.filter(i => rankScopeIds.has(i.entryId))
      : myTierList.items
    for (const c of enrichUserList(scopedItems, rankedTiers)) {
      map.set(c.entryId, { globalRank: c.globalRank, globalFracRank: c.globalFracRank })
    }
    return map
  })()

  return (
    <div className="rank-table">
      <TableHeader />
      {entries.map((entry, i) => {
        const myItem = myTierList?.items.find(item => item.entryId === entry.id) ?? null
        const myR = myRankByEntry.get(entry.id)
        return (
        <React.Fragment key={entry.id}>
          <EntryRow
            entry={entry}
            rank={i + 1}
            myTier={myItem?.tier ?? null}
            myRank={myR?.globalRank ?? null}
            myRankFractional={myR?.globalFracRank ?? null}
            isOpen={quickAddId === entry.id}
            onAdd={() => setQuickAddId(quickAddId === entry.id ? null : entry.id)}
          />
          {quickAddId === entry.id && (
            <QuickAddPanel
              entry={entry}
              myTierList={myTierList}
              onAdd={(tier, slot) => handleQuickAdd(entry.id, tier, slot)}
              onRemove={() => handleRemove(entry.id)}
              onClose={() => setQuickAddId(null)}
            />
          )}
        </React.Fragment>
        )
      })}
    </div>
  )
}

export function CommunityListSkeleton() {
  return (
    <div className="rank-table" style={{ opacity: 0.55 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rank-row" style={{ height: 64 }} />
      ))}
    </div>
  )
}

export function RankCommunityBody({
  topicSlug,
  entriesPromise,
  personalDataPromise,
  genreId,
}: {
  topicSlug: string
  entriesPromise: Promise<CommunityEntries | null>
  personalDataPromise: Promise<PersonalRankData>
  // When set, the community data has been pre-filtered to a specific
  // genre and the "load more" fetch must pass the same filter so pages
  // past the first 100 don't suddenly show out-of-genre entries.
  genreId?: number
}) {
  const { lang } = useParams() as { lang: string }
  const dict = getDict(lang)
  const t = dict.rank
  const data = use(entriesPromise)
  const initialEntries = data?.initialEntries ?? []
  const totalEntries = data?.totalEntries ?? 0

  const ctx = useContext(RankSortContext)
  const sortMode = ctx?.sortMode ?? 'combined'
  const decade = ctx?.decade ?? null
  const setDecade = ctx?.setDecade ?? (() => {})
  const [quickAddId, setQuickAddId] = useState<string | null>(null)
  const [displayCount, setDisplayCount] = useState(100)
  const [allEntries, setAllEntries] = useState(initialEntries)
  const [isLoadingFull, setIsLoadingFull] = useState(initialEntries.length < totalEntries)

  useEffect(() => {
    if (!isLoadingFull) return
    fetchAllRankEntries(topicSlug, lang, genreId).then(entries => {
      setAllEntries(entries)
      setIsLoadingFull(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { setDisplayCount(100) }, [sortMode, decade])

  const decadeCounts = React.useMemo(() => {
    const map = new Map<number, number>()
    for (const e of allEntries) {
      if (e.year === null || e.year === undefined) continue
      const d = Math.floor(e.year / 10) * 10
      map.set(d, (map.get(d) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([d, count]) => ({ decade: d, count }))
      .sort((a, b) => b.decade - a.decade)
  }, [allEntries])

  // If the currently selected decade disappears (e.g. topic swap), clear it
  // so we don't strand the user on an empty view.
  useEffect(() => {
    if (decade === null) return
    if (!decadeCounts.some(d => d.decade === decade)) setDecade(null)
  }, [decade, decadeCounts, setDecade])

  const filtered = decade === null
    ? allEntries
    : allEntries.filter(e => e.year !== null && e.year !== undefined && Math.floor(e.year / 10) * 10 === decade)

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'tier') {
      if (a.avgTierScore === null && b.avgTierScore === null) return 0
      if (a.avgTierScore === null) return 1
      if (b.avgTierScore === null) return -1
      return b.avgTierScore - a.avgTierScore || (a.avgRank ?? 999) - (b.avgRank ?? 999)
    }
    if (sortMode === 'rank') {
      if (a.avgRank === null && b.avgRank === null) return (b.avgTierScore ?? 0) - (a.avgTierScore ?? 0)
      if (a.avgRank === null) return 1
      if (b.avgRank === null) return -1
      return a.avgRank - b.avgRank
    }
    if (sortMode === 'favorite') {
      return b.favoriteCount - a.favoriteCount || (b.avgTierScore ?? 0) - (a.avgTierScore ?? 0)
    }
    if (sortMode === 'popular') {
      return b.tierCount - a.tierCount || (b.avgTierScore ?? 0) - (a.avgTierScore ?? 0)
    }
    return combinedScore(b) - combinedScore(a)
  })

  const visibleEntries = sorted.slice(0, displayCount)

  // On a genre page the entries list has been pre-filtered server-side,
  // so scope "my rank" to that subset too — otherwise a user ranked #17
  // globally would still appear as #17 instead of #3 among comedies.
  const rankScopeIds = React.useMemo(
    () => genreId !== undefined ? new Set(allEntries.map(e => e.id)) : undefined,
    [genreId, allEntries],
  )

  const isFr = lang === 'fr'
  const emptyForDecade = decade !== null && sorted.length === 0 && allEntries.length > 0

  return (
    <>
      <RankToolbar decadeCounts={decadeCounts} />
      {sorted.length === 0 ? (
        emptyForDecade ? (
          <div style={{ padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <p style={{ color: 'var(--fg-5)', fontSize: 14, margin: 0 }}>
              {isFr
                ? `Aucune œuvre des années ${decade} dans cette liste.`
                : `Nothing from the ${decade}s in this list.`}
            </p>
            <button
              onClick={() => setDecade(null)}
              style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-3)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {isFr ? 'Voir toutes les décennies' : 'Show all decades'}
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-5)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{t.noEntries}</p>
        )
      ) : (
        <>
          <Suspense
            fallback={
              <div className="rank-table">
                <TableHeader />
                {visibleEntries.map((entry, i) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    rank={i + 1}
                    myTier={null}
                    myRank={null}
                    myRankFractional={null}
                    isOpen={false}
                    onAdd={() => {}}
                  />
                ))}
              </div>
            }
          >
            <UserAwareEntryList
              personalDataPromise={personalDataPromise}
              entries={visibleEntries}
              topicSlug={topicSlug}
              quickAddId={quickAddId}
              setQuickAddId={setQuickAddId}
              onApplyMyChange={(prev, next, prevR, nextR) =>
                setAllEntries(curr => applyMyListChange(curr, prev, next, prevR, nextR))
              }
              rankScopeIds={rankScopeIds}
            />
          </Suspense>
          {isLoadingFull && sorted.length <= displayCount && (
            <div style={{ width: '100%', marginTop: 16, padding: '12px', textAlign: 'center', color: 'var(--fg-6)', fontSize: 12 }}>
              {isFr ? 'Chargement des éléments suivants…' : 'Loading more entries…'}
            </div>
          )}
          {!isLoadingFull && sorted.length > displayCount && (
            <button
              onClick={() => setDisplayCount(c => c + 100)}
              style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-5)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {isFr
                ? `Voir plus (${sorted.length - displayCount} restants)`
                : `Show more (${sorted.length - displayCount} remaining)`}
            </button>
          )}
        </>
      )}
    </>
  )
}

