'use client'

import React, { use, useState, useEffect, useRef, useContext, createContext, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { fetchAllRankEntries } from '@/app/actions/rankEntries'
import { type UserEntryListData } from './UserEntryListSection'
import type { RankEntry, CommunityEntries } from '@/lib/communityRankData'
import { combinedScore } from '@/lib/communityRankScore'
import { pickTitle } from '@/lib/i18n'
import Link from 'next/link'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#3b82f6', TB: '#22c55e', BO: '#84cc16', AB: '#eab308', PA: '#f97316', IN: '#ef4444', MA: '#737373',
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

const RankSortContext = createContext<{ sortMode: SortMode; setSortMode: (m: SortMode) => void } | null>(null)

export function RankSortProvider({ children }: { children: React.ReactNode }) {
  const [sortMode, setSortMode] = useState<SortMode>('combined')
  return (
    <RankSortContext.Provider value={{ sortMode, setSortMode }}>
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

function QuickAddPanel({
  entry,
  myTierList,
  onAdd,
  onToggleRanking,
  onRemove,
  onClose,
}: {
  entry: Entry
  myTierList: UserEntryListData | null
  onAdd: (tier: string, insertBeforeId?: string) => Promise<void>
  onToggleRanking: (tier: string) => Promise<void>
  onRemove: () => Promise<void>
  onClose: () => void
}) {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const rankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
  const currentTierOfEntry = myTierList?.items.find(i => i.entryId === entry.id)?.tier ?? null

  const [selectedTier, setSelectedTier] = useState<string | null>(currentTierOfEntry)
  const [insertBefore, setInsertBefore] = useState<string | 'end'>('end')
  const [isPending, setIsPending] = useState(false)

  const isRanked = selectedTier ? rankedTiers.includes(selectedTier) : false
  const currentTierItems: ListItemData[] = selectedTier
    ? (myTierList?.items ?? [])
        .filter(i => i.tier === selectedTier && i.entryId !== entry.id)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    : []

  async function handleConfirm() {
    if (!selectedTier) return
    setIsPending(true)
    await onAdd(selectedTier, isRanked && insertBefore !== 'end' ? insertBefore : undefined)
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
              onClick={() => { setSelectedTier(tier); setInsertBefore('end') }}
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

      {/* Mode toggle for the selected tier (only on existing lists) */}
      {selectedTier && myTierList && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-6)' }}>
            Mode pour {TIER_LABEL[selectedTier]} :
          </span>
          <div role="group" aria-label="Mode du tier" style={{ display: 'flex', borderRadius: 7, border: `1px solid ${isRanked ? 'var(--accent-muted)' : 'var(--border)'}`, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-subtle)' }}>
            <button
              onClick={() => isRanked && onToggleRanking(selectedTier)}
              title="Films groupés sans ordre dans cette mention"
              style={{ padding: '4px 9px', border: 'none', background: !isRanked ? 'var(--bg-card)' : 'transparent', color: !isRanked ? 'var(--fg-3)' : 'var(--fg-6)', fontSize: 10.5, fontWeight: !isRanked ? 700 : 500, cursor: !isRanked ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span aria-hidden style={{ fontSize: 11, opacity: 0.85 }}>▦</span>
              Vrac
            </button>
            <button
              onClick={() => !isRanked && onToggleRanking(selectedTier)}
              title="Classer les films par rang (1, 2, 3…) dans cette mention"
              style={{ padding: '4px 9px', border: 'none', borderLeft: '1px solid var(--border)', background: isRanked ? 'var(--accent-fg)' : 'transparent', color: isRanked ? 'var(--btn-text)' : 'var(--fg-6)', fontSize: 10.5, fontWeight: isRanked ? 800 : 500, cursor: isRanked ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span aria-hidden style={{ fontFamily: "'Fraunces', serif", fontWeight: 800 }}>1·2·3</span>
              <span style={{ fontWeight: 600 }}>Classé</span>
            </button>
          </div>
        </div>
      )}

      {/* Position picker for ranked tiers */}
      {isRanked && selectedTier && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-6)', marginBottom: 4 }}>
            Position dans {TIER_LABEL[selectedTier]} :
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: insertBefore === 'end' ? 'var(--fg-2)' : 'var(--fg-6)', padding: '3px 0' }}>
            <input type="radio" name="pos" checked={insertBefore === 'end'} onChange={() => setInsertBefore('end')} style={{ accentColor: TIER_COLOR[selectedTier] }} />
            En dernier ({currentTierItems.length + 1}e)
          </label>
          {currentTierItems.map((item, idx) => (
            <label key={item.entryId} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: insertBefore === item.entryId ? 'var(--fg-2)' : 'var(--fg-6)', padding: '3px 0' }}>
              <input type="radio" name="pos" checked={insertBefore === item.entryId} onChange={() => setInsertBefore(item.entryId)} style={{ accentColor: TIER_COLOR[selectedTier] }} />
              Avant « {pickTitle(item.entry, lang)} » (#{idx + 1})
            </label>
          ))}
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

// User's "favorite" entry: the #1 of the highest ranked tier they have voted on.
// Mirrors the favoriteCount aggregation in lib/communityRankData.ts.
function findUserFavorite(items: ListItemData[], rankedTiers: string[]): string | null {
  for (const tier of TIERS) {
    if (!rankedTiers.includes(tier)) continue
    const top = items.find(i => i.tier === tier && i.position === 1)
    if (top) return top.entryId
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
  const prevMap = new Map<string, ListItemData>()
  for (const i of prevItems) prevMap.set(i.entryId, i)
  const newMap = new Map<string, ListItemData>()
  for (const i of newItems) newMap.set(i.entryId, i)

  const prevFav = findUserFavorite(prevItems, prevRanked)
  const newFav = findUserFavorite(newItems, newRanked)

  const affected = new Set<string>()
  for (const id of prevMap.keys()) affected.add(id)
  for (const id of newMap.keys()) affected.add(id)
  if (prevFav) affected.add(prevFav)
  if (newFav) affected.add(newFav)

  return entries.map(e => {
    if (!affected.has(e.id)) return e

    const prev = prevMap.get(e.id) ?? null
    const next = newMap.get(e.id) ?? null

    // tierDistribution + tierCount + avgTierScore
    const newDist: Record<string, number> = { ...e.tierDistribution }
    if (prev?.tier) newDist[prev.tier] = Math.max(0, (newDist[prev.tier] ?? 0) - 1)
    if (next?.tier) newDist[next.tier] = (newDist[next.tier] ?? 0) + 1

    let totalScore = 0
    let totalCount = 0
    for (const [t, c] of Object.entries(newDist)) {
      const v = TIER_VALUE[t]
      if (v === undefined) continue
      totalScore += v * c
      totalCount += c
    }

    // avgRank + rankCount via geometric mean (sumLog = log(avgRank) × rankCount)
    let sumLog = e.avgRank !== null && e.rankCount > 0 ? Math.log(e.avgRank) * e.rankCount : 0
    let newRankCount = e.rankCount
    const prevWasRanked = !!(prev?.tier && prev.position && prev.position >= 1 && prevRanked.includes(prev.tier))
    const nextIsRanked = !!(next?.tier && next.position && next.position >= 1 && newRanked.includes(next.tier))
    if (prevWasRanked && prev!.position) {
      sumLog -= Math.log(prev!.position!)
      newRankCount -= 1
    }
    if (nextIsRanked && next!.position) {
      sumLog += Math.log(next!.position!)
      newRankCount += 1
    }
    const newAvgRank = newRankCount > 0 ? Math.exp(sumLog / newRankCount) : null

    // favoriteCount delta
    let favCount = e.favoriteCount
    if (prevFav === e.id) favCount = Math.max(0, favCount - 1)
    if (newFav === e.id) favCount += 1

    return {
      ...e,
      tierDistribution: newDist,
      tierCount: totalCount,
      avgTierScore: totalCount > 0 ? totalScore / totalCount : null,
      avgRank: newAvgRank,
      rankCount: newRankCount,
      favoriteCount: favCount,
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
            tip={`Score = mention ajustée × 4 + bonus de rang.\n\n• Mention ajustée : moyenne des avis sur 7, lissée vers « Assez bien » (4) tant qu'il y a peu de votes — un seul "Excellent" pèse moins qu'un consensus à dix avis.\n\n• Bonus de rang : récompense logarithmique des hautes positions (#1 vaut bien plus que #10), pondérée par le nombre de classements.\n\nLe tout favorise les films à la fois bien notés et bien classés, sans laisser un avis isolé fausser le résultat.`}
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

function EntryRow({ entry, rank, isLoggedIn, myTier, myPosition, isOpen, onAdd }: {
  entry: Entry
  rank: number
  isLoggedIn: boolean
  myTier: string | null
  myPosition: number | null
  isOpen: boolean
  onAdd: () => void
}) {
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
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>{displayTitle}</div>
        {entry.year && <div style={{ fontSize: 12, color: 'var(--fg-5)', marginTop: 1 }}>{entry.year}</div>}
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
        <div className="col-avg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {entry.avgRank !== null ? (
            <>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                #{entry.avgRank.toFixed(1)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--fg-6)' }}>
                {entry.rankCount} classement{entry.rankCount > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--fg-7)' }}>—</span>
          )}
        </div>

        {/* Ma note (cliquable : modifier/ajouter) */}
        {isLoggedIn ? (
          <button
            onClick={onAdd}
            title={myTier ? 'Modifier ma note' : 'Noter ce film'}
            className="col-mynote"
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
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
                  {myPosition != null && (
                    <span
                      title="Ma position dans mon classement personnel"
                      style={{ fontSize: 11, color: 'var(--fg-6)', fontFamily: "'Fraunces', serif" }}
                    >
                      #{myPosition}
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
        ) : (
          <Link
            href={`/${lang}/auth/login`}
            title={lang === 'fr' ? 'Connecte-toi pour noter' : 'Sign in to rate'}
            className="col-mynote"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 32, borderRadius: 7, textDecoration: 'none',
              border: '1px solid transparent',
              fontSize: 18, color: 'var(--fg-4)',
            }}
          >
            +
          </Link>
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
}: {
  personalDataPromise: Promise<PersonalRankData>
  entries: Entry[]
  topicSlug: string
  quickAddId: string | null
  setQuickAddId: (id: string | null) => void
  onApplyMyChange: (prev: ListItemData[], next: ListItemData[], prevRanked: string[], nextRanked: string[]) => void
}) {
  const { userLists: initialLists, currentUserId, isLoggedIn } = use(personalDataPromise)
  const [lists, setLists] = useState(initialLists)
  const myTierList = lists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  async function handleQuickAdd(entryId: string, tier: string, insertBeforeId?: string) {
    const currentItems = myTierList?.items ?? []
    const rankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
    const withoutEntry = currentItems.filter(i => i.entryId !== entryId)
    const isRanked = rankedTiers.includes(tier)

    let newItems: Array<{ entryId: string; tier?: string; position?: number }>

    if (isRanked) {
      const tierItems = withoutEntry
        .filter(i => i.tier === tier)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      const insertIdx = insertBeforeId ? tierItems.findIndex(i => i.entryId === insertBeforeId) : -1
      const actualIdx = insertIdx === -1 ? tierItems.length : insertIdx
      const newTierItems = [
        ...tierItems.slice(0, actualIdx),
        { entryId, tier, position: 0 },
        ...tierItems.slice(actualIdx),
      ].map((item, i) => ({ entryId: item.entryId, tier: item.tier ?? undefined, position: i + 1 }))
      newItems = [
        ...withoutEntry.filter(i => i.tier !== tier).map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined })),
        ...newTierItems,
      ]
    } else {
      newItems = [
        ...withoutEntry.map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined })),
        { entryId, tier },
      ]
    }

    const updated = await saveUserEntryLists(topicSlug, [], newItems, rankedTiers, { revalidate: false })
    const newMy = updated.find(l => l.type === 'TIER' || l.type === 'BOTH') ?? null
    onApplyMyChange(
      myTierList?.items ?? [],
      newMy?.items ?? [],
      (myTierList?.rankedTiers ?? '').split(',').filter(Boolean),
      (newMy?.rankedTiers ?? '').split(',').filter(Boolean),
    )
    setLists(prev => [...prev.filter(l => l.userId !== currentUserId), ...updated])
    setQuickAddId(null)
  }

  async function handleRemove(entryId: string) {
    if (!myTierList) return
    const rankedTiers = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    const removed = myTierList.items.find(i => i.entryId === entryId)
    if (!removed) return
    const removedTier = removed.tier
    const remaining = myTierList.items.filter(i => i.entryId !== entryId)

    let newItems: Array<{ entryId: string; tier?: string; position?: number }>
    if (removedTier && rankedTiers.includes(removedTier)) {
      // Recompact positions in the affected ranked tier (1, 2, 3, …)
      const tierItems = remaining
        .filter(i => i.tier === removedTier)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        .map((item, i) => ({ entryId: item.entryId, tier: item.tier ?? undefined, position: i + 1 }))
      const others = remaining
        .filter(i => i.tier !== removedTier)
        .map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined }))
      newItems = [...others, ...tierItems]
    } else {
      newItems = remaining.map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined }))
    }

    const updated = await saveUserEntryLists(topicSlug, [], newItems, rankedTiers, { revalidate: false })
    const newMy = updated.find(l => l.type === 'TIER' || l.type === 'BOTH') ?? null
    onApplyMyChange(
      myTierList?.items ?? [],
      newMy?.items ?? [],
      (myTierList?.rankedTiers ?? '').split(',').filter(Boolean),
      (newMy?.rankedTiers ?? '').split(',').filter(Boolean),
    )
    setLists(prev => [...prev.filter(l => l.userId !== currentUserId), ...updated])
    setQuickAddId(null)
  }

  async function handleToggleRanking(tier: string) {
    if (!myTierList) return
    const currentRankedTiers = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    const willBeRanked = !currentRankedTiers.includes(tier)
    const newRankedTiers = willBeRanked
      ? [...currentRankedTiers, tier].sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b))
      : currentRankedTiers.filter(t => t !== tier)

    let pos = 1
    const newItems = myTierList.items.map(i => {
      if (i.tier !== tier) {
        return { entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined, note: i.note ?? undefined }
      }
      return {
        entryId: i.entryId,
        tier: i.tier ?? undefined,
        position: willBeRanked ? pos++ : undefined,
        note: i.note ?? undefined,
      }
    })

    const updated = await saveUserEntryLists(topicSlug, [], newItems, newRankedTiers, { revalidate: false })
    const newMy = updated.find(l => l.type === 'TIER' || l.type === 'BOTH') ?? null
    onApplyMyChange(
      myTierList.items,
      newMy?.items ?? [],
      (myTierList.rankedTiers ?? '').split(',').filter(Boolean),
      (newMy?.rankedTiers ?? '').split(',').filter(Boolean),
    )
    setLists(prev => [...prev.filter(l => l.userId !== currentUserId), ...updated])
  }

  return (
    <div className="rank-table">
      <TableHeader />
      {entries.map((entry, i) => {
        const myItem = myTierList?.items.find(item => item.entryId === entry.id) ?? null
        return (
        <React.Fragment key={entry.id}>
          <EntryRow
            entry={entry}
            rank={i + 1}
            isLoggedIn={isLoggedIn}
            myTier={myItem?.tier ?? null}
            myPosition={myItem?.position ?? null}
            isOpen={quickAddId === entry.id}
            onAdd={() => setQuickAddId(quickAddId === entry.id ? null : entry.id)}
          />
          {quickAddId === entry.id && (
            <QuickAddPanel
              entry={entry}
              myTierList={myTierList}
              onAdd={(tier, insertBeforeId) => handleQuickAdd(entry.id, tier, insertBeforeId)}
              onToggleRanking={handleToggleRanking}
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
}: {
  topicSlug: string
  entriesPromise: Promise<CommunityEntries | null>
  personalDataPromise: Promise<PersonalRankData>
}) {
  const { lang } = useParams() as { lang: string }
  const dict = getDict(lang)
  const t = dict.rank
  const data = use(entriesPromise)
  const initialEntries = data?.initialEntries ?? []
  const totalEntries = data?.totalEntries ?? 0

  const ctx = useContext(RankSortContext)
  const sortMode = ctx?.sortMode ?? 'combined'
  const [quickAddId, setQuickAddId] = useState<string | null>(null)
  const [displayCount, setDisplayCount] = useState(100)
  const [allEntries, setAllEntries] = useState(initialEntries)
  const [isLoadingFull, setIsLoadingFull] = useState(initialEntries.length < totalEntries)

  useEffect(() => {
    if (!isLoadingFull) return
    fetchAllRankEntries(topicSlug, lang).then(entries => {
      setAllEntries(entries)
      setIsLoadingFull(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { setDisplayCount(100) }, [sortMode])

  const sorted = [...allEntries].sort((a, b) => {
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

  return (
    <>
      {sorted.length === 0 ? (
        <p style={{ color: 'var(--fg-5)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{t.noEntries}</p>
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
                    isLoggedIn={false}
                    myTier={null}
                    myPosition={null}
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
            />
          </Suspense>
          {isLoadingFull && sorted.length <= displayCount && (
            <div style={{ width: '100%', marginTop: 16, padding: '12px', textAlign: 'center', color: 'var(--fg-6)', fontSize: 12 }}>
              Chargement des éléments suivants…
            </div>
          )}
          {!isLoadingFull && sorted.length > displayCount && (
            <button
              onClick={() => setDisplayCount(c => c + 100)}
              style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-5)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Voir plus ({sorted.length - displayCount} restants)
            </button>
          )}
        </>
      )}
    </>
  )
}

