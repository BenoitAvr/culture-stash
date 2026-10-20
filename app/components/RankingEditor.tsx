'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/dictionaries/client'

export type RankableItem = {
  id: string
  label: string
  prefix?: string
  suffix?: string
  cover?: string | null
  year?: number | null
  tierCount?: number
  score?: number
}

type TopFilter = { kind: 'popular' | 'rated'; count: number } | null

export type RankEditItem = {
  id: string
  position?: number
  tier?: string
  note?: string
}

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
// Short subjective hint shown under each mention — makes it clear a tier is a
// personal appreciation, not a rating out of 7.
const TIER_SUBJECTIVE: Record<string, string> = {
  EX: 'Chef-d’œuvre, m’a fasciné',
  TB: 'J’ai adoré, à revoir',
  BO: 'J’ai bien aimé',
  AB: 'Pas mal, sans plus',
  PA: 'Moyen, oubliable',
  IN: 'Déçu, raté',
  MA: 'Détesté, à éviter',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#5b8dee', TB: '#388e3c', BO: '#66bb6a', AB: '#a3c940', PA: '#f9c933', IN: '#f5a623', MA: '#e05555',
}

function normalizeTitle(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function EditorTopDropdown({
  top,
  setTop,
}: {
  top: TopFilter
  setTop: (t: TopFilter) => void
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

  const active = top !== null
  const label = active
    ? (top.kind === 'popular'
        ? `Top ${top.count} populaires`
        : `Top ${top.count} mieux notés`)
    : 'Top'

  const options: Array<{ label: string; value: NonNullable<TopFilter> }> = [
    { label: 'Top 10 populaires', value: { kind: 'popular', count: 10 } },
    { label: 'Top 100 populaires', value: { kind: 'popular', count: 100 } },
    { label: 'Top 10 mieux notés', value: { kind: 'rated', count: 10 } },
    { label: 'Top 100 mieux notés', value: { kind: 'rated', count: 100 } },
  ]

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={active ? label : 'Filtrer les films restants sur un top de la communauté'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0 14px', height: '100%', minHeight: 40,
          borderRadius: 9,
          border: `1.5px solid ${active ? 'var(--accent-fg)' : 'var(--border)'}`,
          background: active ? 'var(--accent-faint)' : 'var(--bg-input)',
          color: active ? 'var(--accent-fg)' : 'var(--fg-3)',
          fontSize: 13,
          fontWeight: active ? 700 : 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{label}</span>
        <span aria-hidden style={{ fontSize: 14, opacity: 0.75, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Filtrer sur un top"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            zIndex: 40,
            background: 'var(--bg-card)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: '0 -6px 24px rgba(0,0,0,.14)',
            minWidth: 220,
            padding: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <button
            type="button"
            role="option"
            aria-selected={top === null}
            onClick={() => { setTop(null); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '7px 12px', borderRadius: 6,
              border: 'none', background: top === null ? 'var(--bg-subtle)' : 'transparent',
              color: top === null ? 'var(--fg-2)' : 'var(--fg-3)',
              fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: top === null ? 600 : 500,
              textAlign: 'left',
            }}
          >
            Toutes les œuvres
          </button>
          <div aria-hidden style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />
          {options.map((opt, i) => {
            const isActive = top !== null && top.kind === opt.value.kind && top.count === opt.value.count
            const isSectionBreak = i === 2
            return (
              <React.Fragment key={`${opt.value.kind}-${opt.value.count}`}>
                {isSectionBreak && <div aria-hidden style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />}
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setTop(isActive ? null : opt.value); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, padding: '7px 12px', borderRadius: 6,
                    border: 'none', background: isActive ? 'var(--bg-subtle)' : 'transparent',
                    color: isActive ? 'var(--fg-2)' : 'var(--fg-3)',
                    fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                    fontWeight: isActive ? 600 : 500,
                    textAlign: 'left',
                  }}
                >
                  {opt.label}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditorDecadeDropdown({
  decadeCounts,
  decade,
  setDecade,
}: {
  decadeCounts: Array<{ decade: number; count: number }>
  decade: number | null
  setDecade: (d: number | null) => void
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
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={active ? `Filtré : années ${decade}` : 'Filtrer les films restants par décennie'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0 14px', height: '100%', minHeight: 40,
          borderRadius: 9,
          border: `1.5px solid ${active ? 'var(--accent-fg)' : 'var(--border)'}`,
          background: active ? 'var(--accent-faint)' : 'var(--bg-input)',
          color: active ? 'var(--accent-fg)' : 'var(--fg-3)',
          fontSize: 13,
          fontWeight: active ? 700 : 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span>Décennie{active ? ` : ${decade}s` : ''}</span>
        <span aria-hidden style={{ fontSize: 14, opacity: 0.75, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Filtrer par décennie"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            zIndex: 40,
            background: 'var(--bg-card)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: '0 -6px 24px rgba(0,0,0,.14)',
            minWidth: 220,
            padding: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            maxHeight: 320,
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
            <span>Toutes les décennies</span>
            <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          </button>
          <div aria-hidden style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />
          {decadeCounts.map(({ decade: d, count }) => {
            const isActive = decade === d
            return (
              <button
                key={d}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => { setDecade(isActive ? null : d); setOpen(false) }}
                title={`${d} à ${d + 9}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '7px 12px', borderRadius: 6,
                  border: 'none', background: isActive ? 'var(--bg-subtle)' : 'transparent',
                  color: isActive ? 'var(--fg-2)' : 'var(--fg-3)',
                  fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
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

export function RankingEditor({
  items,
  initialTierItems,
  initialRankedTiers,
  hasExisting,
  onSave,
  onCancel,
  t,
  addFormAction,
  addPending,
  addError,
  addEntryLabel,
}: {
  items: RankableItem[]
  initialTierItems: RankEditItem[]
  initialRankedTiers: string[]
  hasExisting: boolean
  onSave: (tier: RankEditItem[], rankedTiers: string[]) => Promise<void>
  onCancel: () => void
  t: Dict['rankings']
  addFormAction?: (payload: FormData) => void
  addPending?: boolean
  addError?: string | null
  addEntryLabel?: string
}) {
  const [tierItems, setTierItems] = useState<RankEditItem[]>(initialTierItems)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const tierItemsRef = useRef(tierItems)
  const onSaveRef = useRef(onSave)
  tierItemsRef.current = tierItems
  onSaveRef.current = onSave

  const computeSnapshot = () => JSON.stringify({
    items: [...tierItemsRef.current]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(i => ({ id: i.id, tier: i.tier ?? null, position: i.position ?? null, note: i.note ?? null })),
  })

  // Legacy param kept for signature compatibility; the parent recomputes
  // active tiers from the items it receives.
  void initialRankedTiers

  const lastSavedRef = useRef<string>('')
  const initSnapshotRef = useRef(false)
  if (!initSnapshotRef.current) {
    lastSavedRef.current = computeSnapshot()
    initSnapshotRef.current = true
  }

  const flushSave = async () => {
    const snapshot = computeSnapshot()
    if (snapshot === lastSavedRef.current) return
    setSaveStatus('saving')
    try {
      // Every tier that holds items is implicitly ranked in the new model.
      // We still pass the active tier list for backward-compat.
      const activeTiers = TIERS.filter(t => tierItemsRef.current.some(i => i.tier === t))
      await onSaveRef.current(tierItemsRef.current, activeTiers)
      if (computeSnapshot() === snapshot) {
        lastSavedRef.current = snapshot
        setSaveStatus('saved')
      } else {
        setSaveStatus('dirty')
      }
    } catch (e) {
      console.error('[RankingEditor] autosave failed', e)
      setSaveStatus('error')
    }
  }

  const [tierDragId, setTierDragId] = useState<string | null>(null)
  const [dragOverTier, setDragOverTier] = useState<string | null>(null)
  // Where in a tier the user is about to drop. `kind: 'join'` means merge
  // into an existing rank group (tie); `kind: 'insert'` means create a new
  // rank at that slot. `atRank` is the integer rank in the target tier.
  const [dragOverSlot, setDragOverSlot] = useState<
    | { tier: string; kind: 'join'; rank: number }
    | { tier: string; kind: 'insert'; beforeRank: number | null }
    | null
  >(null)
  const [moveCardId, setMoveCardId] = useState<string | null>(null)
  const [moveTier, setMoveTier] = useState<string | null>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<{ matched: RankEditItem[]; unmatched: string[] } | null>(null)
  const [search, setSearch] = useState('')
  const [decadeFilter, setDecadeFilter] = useState<number | null>(null)
  // Fresh tier lists get pre-filtered to the community's Top 100 mieux notés
  // so a first-timer sees the most valuable films to rank first, not a random
  // slice of the catalogue. Existing lists keep the full catalogue visible
  // so users can hunt for anything.
  const [topFilter, setTopFilter] = useState<TopFilter>(
    !hasExisting && items.some(i => (i.tierCount ?? 0) > 0)
      ? { kind: 'rated', count: 100 }
      : null,
  )
  const [quickAddId, setQuickAddId] = useState<string | null>(null)
  const [quickAddTier, setQuickAddTier] = useState<string | null>(null)
  const [unclassifiedLimit, setUnclassifiedLimit] = useState(18)

  // Reset the cap whenever the filter set changes, so a leftover "+18" chain
  // from a previous view doesn't balloon the render into a new (potentially
  // huge) match set.
  useEffect(() => { setUnclassifiedLimit(18) }, [search, decadeFilter, topFilter])

  const decadeCounts = (() => {
    const unclassifiedItems = items.filter(item => !tierItems.some(i => i.id === item.id))
    const map = new Map<number, number>()
    for (const item of unclassifiedItems) {
      if (item.year === null || item.year === undefined) continue
      const d = Math.floor(item.year / 10) * 10
      map.set(d, (map.get(d) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([d, count]) => ({ decade: d, count }))
      .sort((a, b) => b.decade - a.decade)
  })()
  const hasYearData = decadeCounts.length > 0
  const hasRatings = items.some(item => (item.tierCount ?? 0) > 0)

  const topIds = (() => {
    if (topFilter === null) return null
    const rated = items
      .filter(item => (item.tierCount ?? 0) > 0)
      .map(item => ({
        id: item.id,
        key: topFilter.kind === 'popular' ? (item.tierCount ?? 0) : (item.score ?? 0),
      }))
      .sort((a, b) => b.key - a.key)
      .slice(0, topFilter.count)
    return new Set(rated.map(r => r.id))
  })()

  useEffect(() => {
    if (decadeFilter === null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!decadeCounts.some(d => d.decade === decadeFilter)) setDecadeFilter(null)
  }, [decadeFilter, decadeCounts])
  // Keep the search text after a successful add: with it still typed, the
  // freshly-inserted entry (whose title matches what the user typed) stays
  // visible in the filtered strip, so they see what they just added.

  // Mark dirty on edits
  useEffect(() => {
    if (computeSnapshot() === lastSavedRef.current) return
    setSaveStatus(prev => prev === 'saving' ? prev : 'dirty')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierItems])

  // Debounced autosave (30s after last change)
  useEffect(() => {
    if (saveStatus !== 'dirty') return
    const t = setTimeout(() => { flushSave() }, 30000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus, tierItems])

  // Save on tab hide / unload / unmount
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushSave() }
    const onUnload = () => { flushSave() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
      flushSave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getItem = (id: string) => items.find(e => e.id === id)

  function findItem(title: string): RankableItem | null {
    const norm = normalizeTitle(title)
    const exact = items.find(e => normalizeTitle(e.label) === norm)
    if (exact) return exact
    const sub = items.find(e => {
      const en = normalizeTitle(e.label)
      if (en.length < 4 || norm.length < 4) return false
      return en.includes(norm) || norm.includes(en)
    })
    if (sub) return sub
    return items.find(e => {
      const en = normalizeTitle(e.label)
      if (en.length < 6 || norm.length < 6) return false
      const maxDist = Math.max(1, Math.floor(Math.min(en.length, norm.length) / 8))
      return levenshtein(en, norm) <= maxDist
    }) ?? null
  }

  function findTierFromLine(line: string): string | null {
    const stripped = line.replace(/\s*:\s*$/, '').trim()
    if (!stripped) return null
    if (TIERS.includes(stripped.toUpperCase())) return stripped.toUpperCase()
    const norm = normalizeTitle(stripped)
    for (const tier of TIERS) {
      const labelNorm = normalizeTitle(TIER_LABEL[tier])
      if (norm === labelNorm) return tier
      if (norm.length >= 3 && labelNorm.startsWith(norm)) return tier
    }
    return null
  }

  function handleAnalyze() {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean)
    const matched: RankEditItem[] = []
    const unmatched: string[] = []
    let currentTier: string | null = null
    let tierPos = 0
    for (const line of lines) {
      if (/:\s*$/.test(line)) {
        const tier = findTierFromLine(line)
        if (tier) { currentTier = tier; tierPos = 0; continue }
      }
      if (!currentTier) continue
      tierPos++
      const numMatch = line.match(/^(\d+)\s*[:.)\-]\s*(.+)$/)
      const title = numMatch ? numMatch[2].trim() : line
      const item = findItem(title)
      if (item && !matched.find(i => i.id === item.id)) {
        // Imported lists come in one line per item → one distinct rank per
        // item. Users can later drag onto a line to tie them.
        matched.push({ id: item.id, tier: currentTier, position: tierPos })
      } else if (!item) {
        unmatched.push(title)
      }
    }
    setImportResult({ matched, unmatched })
  }

  // Rebuild local ranks in `tier` so they are contiguous (1, 2, 3…) while
  // preserving the existing ties (items sharing the same rank keep sharing).
  function compactTier(items: RankEditItem[], tier: string): RankEditItem[] {
    const inTier = items.filter(i => i.tier === tier)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const map = new Map<number, number>()
    let next = 1
    for (const i of inTier) {
      const old = i.position ?? 1
      if (!map.has(old)) map.set(old, next++)
    }
    return items.map(i => {
      if (i.tier !== tier) return i
      const old = i.position ?? 1
      return { ...i, position: map.get(old) ?? old }
    })
  }

  type DropOp =
    | { kind: 'join'; rank: number }
    | { kind: 'insert'; beforeRank: number | null }

  function dropOnTier(id: string, tier: string, op: DropOp) {
    setTierItems(prev => {
      const existing = prev.find(i => i.id === id)
      const oldTier = existing?.tier
      // Working set without the moved item
      const others = prev.filter(i => i.id !== id)
      const otherRanks = Array.from(
        new Set(
          others
            .filter(i => i.tier === tier)
            .map(i => i.position ?? 1),
        ),
      ).sort((a, b) => a - b)
      const maxRank = otherRanks.length === 0 ? 0 : otherRanks[otherRanks.length - 1]

      let newPosition: number
      let shifted: RankEditItem[]

      if (op.kind === 'join') {
        newPosition = op.rank
        shifted = others
      } else {
        // insert
        if (op.beforeRank === null) {
          newPosition = maxRank + 1
          shifted = others
        } else {
          newPosition = op.beforeRank
          shifted = others.map(i => {
            if (i.tier !== tier) return i
            const r = i.position ?? 1
            return r >= op.beforeRank! ? { ...i, position: r + 1 } : i
          })
        }
      }

      let updated: RankEditItem[]
      if (existing) {
        const hit = { ...existing, tier, position: newPosition }
        updated = shifted.some(i => i.id === id)
          ? shifted.map(i => (i.id === id ? hit : i))
          : [...shifted, hit]
      } else {
        updated = [...shifted, { id, tier, position: newPosition }]
      }

      if (oldTier && oldTier !== tier) updated = compactTier(updated, oldTier)
      updated = compactTier(updated, tier)
      return updated
    })
  }

  function dropOnUnclassified(id: string) {
    setTierItems(prev => {
      const item = prev.find(i => i.id === id)
      if (!item?.tier) return prev
      const removed = prev.filter(i => i.id !== id)
      return compactTier(removed, item.tier)
    })
  }

  function removeFromList(id: string) {
    setTierItems(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      const removed = prev.filter(i => i.id !== id)
      return item.tier ? compactTier(removed, item.tier) : removed
    })
  }

  function handleConfirmImport() {
    if (!importResult) return
    setTierItems(importResult.matched)
    setIsImporting(false)
    setImportText('')
    setImportResult(null)
  }

  async function handleClose() {
    await flushSave()
    onCancel()
  }

  const statusContent = (() => {
    switch (saveStatus) {
      case 'saving': return { text: 'Enregistrement…', color: 'var(--fg-5)' }
      case 'saved': return { text: '✓ Enregistré', color: 'var(--accent-fg)' }
      case 'dirty': return { text: '● Modifications…', color: 'var(--fg-5)' }
      case 'error': return { text: '✗ Erreur — réessayer', color: '#e05555' }
      default: return { text: 'Auto-enregistrement actif', color: 'var(--fg-7)' }
    }
  })()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>
          {hasExisting ? t.editListTitle : t.createListTitle}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <button
          onClick={saveStatus === 'error' ? () => flushSave() : undefined}
          disabled={saveStatus !== 'error'}
          title={saveStatus === 'error' ? 'Cliquer pour réessayer' : undefined}
          style={{ padding: '5px 11px', borderRadius: 7, border: 'none', background: 'none', color: statusContent.color, fontSize: 11, fontFamily: 'inherit', cursor: saveStatus === 'error' ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
        >
          {statusContent.text}
        </button>
        {!isImporting && (
          <button
            onClick={() => setIsImporting(true)}
            title="Coller une tier list venant d'un autre site"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1, padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--accent-fg)', background: 'var(--accent-faint)', color: 'var(--accent-fg)', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <span style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '.05em' }}>Déjà une liste ailleurs&nbsp;?</span>
            <span style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>↑ Importe-la</span>
          </button>
        )}
        <button onClick={handleClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--fg-4)', background: 'var(--bg-card)', fontFamily: 'inherit', fontWeight: 500 }}>
          Fermer
        </button>
      </div>

      {/* Import panel */}
      {isImporting && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-4)' }}>Importer une tier list</span>
            <button onClick={() => { setIsImporting(false); setImportText(''); setImportResult(null) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--fg-7)', lineHeight: 1 }}>×</button>
          </div>
          {!importResult ? (
            <>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-6)', lineHeight: 1.7 }}>
                Écris le code du niveau sur sa propre ligne suivi de <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>:</code>, puis les titres en dessous.{' '}
                Niveaux disponibles :{' '}
                {TIERS.map((tier, i) => (
                  <span key={tier}>
                    <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>{tier}</code>
                    {' '}({TIER_LABEL[tier]}){i < TIERS.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={'EX:\nFilm A\nFilm B\n\nTB:\nFilm C\nFilm D\n\nBO:\nFilm E'}
                autoFocus
                style={{ height: 240, padding: '10px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.6, outline: 'none' }}
              />
              <button
                onClick={handleAnalyze}
                disabled={!importText.trim()}
                style={{ alignSelf: 'flex-start', padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontFamily: 'inherit', cursor: importText.trim() ? 'pointer' : 'not-allowed', opacity: importText.trim() ? 1 : 0.5 }}
              >
                Analyser
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                  <span style={{ color: '#4caf50', fontWeight: 600 }}>✓ </span>
                  {importResult.matched.length} entrée{importResult.matched.length !== 1 ? 's' : ''} trouvée{importResult.matched.length !== 1 ? 's' : ''}
                </div>
                {importResult.unmatched.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-5)' }}>
                      <span style={{ color: '#f5a623', fontWeight: 600 }}>⚠ </span>
                      {importResult.unmatched.length} non trouvée{importResult.unmatched.length !== 1 ? 's' : ''} (absentes du topic) :
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 18 }}>
                      {importResult.unmatched.map(u => (
                        <span key={u} style={{ fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 9px', color: 'var(--fg-6)' }}>{u}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleConfirmImport}
                  disabled={importResult.matched.length === 0}
                  style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontFamily: 'inherit', cursor: importResult.matched.length > 0 ? 'pointer' : 'not-allowed', opacity: importResult.matched.length > 0 ? 1 : 0.5 }}
                >
                  Charger dans l&apos;éditeur
                </button>
                <button onClick={() => setImportResult(null)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-6)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                  Réessayer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tiers */}
      <div>
        {TIERS.map((tier, tIdx) => {
          const inTier = tierItems.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          // Group items by their shared local rank. Items in the same group
          // are tied (same user-picked rank number) and show on one line.
          const groups: Array<{ rank: number; items: RankEditItem[] }> = []
          for (const it of inTier) {
            const r = it.position ?? 1
            const last = groups[groups.length - 1]
            if (last && last.rank === r) last.items.push(it)
            else groups.push({ rank: r, items: [it] })
          }
          // Global offsets so this tier's ranks continue the sequence rather
          // than restart at 1. Recompute here (cheap: 7 tiers max) rather than
          // threading through state.
          let priorGroupCount = 0
          let priorItemCount = 0
          for (let i = 0; i < tIdx; i++) {
            const t = TIERS[i]
            const inT = tierItems.filter(x => x.tier === t)
            const distinctRanks = new Set(inT.map(x => x.position ?? 1))
            priorGroupCount += distinctRanks.size
            priorItemCount += inT.length
          }
          // Per-group global rank and fractional (average of occupied global
          // positions).
          const globalRanks = new Map<number, number>()
          const fractionals = new Map<number, number>()
          let runningPos = priorItemCount + 1
          groups.forEach((g, gIdx) => {
            globalRanks.set(g.rank, priorGroupCount + gIdx + 1)
            const posList: number[] = []
            for (let i = 0; i < g.items.length; i++) posList.push(runningPos++)
            fractionals.set(g.rank, posList.reduce((s, p) => s + p, 0) / posList.length)
          })

          const isDropTarget = dragOverTier === tier
          const slot = dragOverSlot && dragOverSlot.tier === tier ? dragOverSlot : null
          const tierColor = TIER_COLOR[tier]
          const cardW = 46
          const placeholderFs = 14
          const closeSz = 13
          const closeFs = 9
          const cardPad = 0
          const cardGap = 2

          // Insert strip between/around rank groups. Dropping here creates
          // a brand new rank at that slot. Grows while a drag is in progress
          // (easy target), swells further and labels itself on direct hover.
          const dragInProgress = tierDragId !== null
          function renderInsertZone(beforeRank: number | null, key: string) {
            const active = slot?.kind === 'insert' && slot.beforeRank === beforeRank
            const idle = !dragInProgress
            return (
              <div
                key={key}
                onDragOver={ev => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  setDragOverTier(tier)
                  setDragOverSlot({ tier, kind: 'insert', beforeRank })
                }}
                onDrop={ev => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  if (tierDragId) dropOnTier(tierDragId, tier, { kind: 'insert', beforeRank })
                  setDragOverTier(null); setDragOverSlot(null); setTierDragId(null)
                }}
                style={{
                  height: active ? 24 : idle ? 3 : 10,
                  margin: '1px 0',
                  borderRadius: 3,
                  background: active ? `${tierColor}22` : (dragInProgress ? `${tierColor}0a` : 'transparent'),
                  border: active
                    ? `1.5px dashed ${tierColor}`
                    : (dragInProgress ? `1px dashed ${tierColor}44` : '1px dashed transparent'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tierColor,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  transition: 'height .12s, background .12s, border-color .12s',
                }}
              >
                {active && '＋ nouveau rang'}
              </div>
            )
          }

          return (
            <div
              key={tier}
              className="tier-row"
            >
              <div
                className="tier-label"
                title={`${TIER_LABEL[tier]} — ${TIER_SUBJECTIVE[tier]}`}
                style={{
                  // Stretch to match the dropzone height so the colored band
                  // reads as the frame of its tier instead of a small chip at
                  // the top.
                  minHeight: 44,
                  borderRadius: 6,
                  background: `${tierColor}1a`,
                  border: `1px solid ${tierColor}55`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  color: tierColor,
                  textAlign: 'center',
                  padding: '5px 6px',
                }}
              >
                <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 15, lineHeight: 1.05 }}>
                  {TIER_LABEL[tier]}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2, opacity: 0.8 }}>
                  {TIER_SUBJECTIVE[tier]}
                </span>
                {inTier.length > 0 && (
                  <span style={{
                    marginTop: 1,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    opacity: 0.6,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {inTier.length} film{inTier.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div
                onDragOver={ev => { ev.preventDefault(); setDragOverTier(tier) }}
                onDragLeave={ev => {
                  if (!ev.currentTarget.contains(ev.relatedTarget as Node)) {
                    setDragOverTier(null)
                    setDragOverSlot(null)
                  }
                }}
                onDrop={ev => {
                  // Catch-all drop on empty space in the tier — happens when
                  // the user releases outside any specific group row / insert
                  // zone. Append a new rank at the end.
                  ev.preventDefault()
                  if (tierDragId && !slot) {
                    dropOnTier(tierDragId, tier, { kind: 'insert', beforeRank: null })
                  }
                  setDragOverTier(null); setDragOverSlot(null); setTierDragId(null)
                }}
                className="tier-dropzone"
                style={{
                  minHeight: 44,
                  // No vertical cap — show every film of the tier at once.
                  // Rows are compact enough that even a 15-film EX fits in a
                  // couple of hundred pixels, and users clearly expect to see
                  // the whole tier without having to hover.
                  background: isDropTarget && !slot ? `${tierColor}0d` : 'transparent',
                  // No border at rest — the tier label on the left already
                  // frames the row and avoids a dashed stroke that reads as
                  // extra whitespace between consecutive tiers. The border
                  // appears only while a card is being dragged over.
                  border: isDropTarget ? `1px dashed ${tierColor}66` : '1px solid transparent',
                  borderRadius: 6,
                  padding: '0 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'background .12s, border-color .12s',
                }}
              >
                {groups.length === 0 ? (
                  <span style={{ color: 'var(--fg-6)', fontSize: 11.5, fontStyle: 'italic', alignSelf: 'center', margin: 'auto' }}>
                    ← glisse un film ici
                  </span>
                ) : (
                  <>
                    {renderInsertZone(groups[0].rank, 'before-first')}
                    {groups.map((g, gIdx) => {
                      const nextRank = groups[gIdx + 1]?.rank ?? null
                      const isJoinTarget = slot?.kind === 'join' && slot.rank === g.rank
                      const displayRank = globalRanks.get(g.rank) ?? g.rank
                      const frac = fractionals.get(g.rank) ?? displayRank
                      const isTied = g.items.length > 1
                      // Top-3 global ranks get a medal ring (gold / silver /
                      // bronze) so the podium stands out, but the badge stays
                      // the same neutral dark pill otherwise.
                      const medalRing = displayRank === 1 ? '#f59e0b'
                        : displayRank === 2 ? '#94a3b8'
                        : displayRank === 3 ? '#b45309'
                        : null
                      const badgeBg = '#1f2937'
                      return (
                        <React.Fragment key={g.rank}>
                          <div
                            onDragOver={ev => {
                              ev.preventDefault()
                              ev.stopPropagation()
                              setDragOverTier(tier)
                              setDragOverSlot({ tier, kind: 'join', rank: g.rank })
                            }}
                            onDrop={ev => {
                              ev.preventDefault()
                              ev.stopPropagation()
                              if (tierDragId) dropOnTier(tierDragId, tier, { kind: 'join', rank: g.rank })
                              setDragOverTier(null); setDragOverSlot(null); setTierDragId(null)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '0 4px',
                              marginTop: gIdx === 0 ? 0 : -1,
                              borderRadius: 6,
                              background: isJoinTarget
                                ? `${tierColor}1f`
                                : (isTied ? `${tierColor}0a` : 'transparent'),
                              outline: isJoinTarget ? `1.5px solid ${tierColor}` : 'none',
                              borderLeft: isTied ? `3px solid ${tierColor}66` : '3px solid transparent',
                              transition: 'background .12s, outline-color .12s',
                            }}
                          >
                            {/* Rank badge — uniform size for every rank, so
                                "1" and "123" occupy the same visual slot and
                                tiers scan vertically without jitter. Top 3
                                get a medal-coloured ring. */}
                            <div
                              aria-label={`Rang ${displayRank}${isTied ? `, ex-æquo (${g.items.length}), rang officiel ${frac.toFixed(1)}` : ''}`}
                              title={isTied ? `${g.items.length} films ex-æquo à ce rang · rang officiel ⌀${frac.toFixed(1)}` : undefined}
                              style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                minWidth: medalRing ? 34 : 30,
                                height: medalRing ? 34 : 30,
                                padding: '0 6px',
                                borderRadius: 999,
                                background: badgeBg,
                                color: '#fff',
                                boxShadow: medalRing
                                  ? `0 0 0 2px ${medalRing}, 0 2px 6px ${medalRing}55`
                                  : '0 1px 3px rgba(0,0,0,.18)',
                                flexShrink: 0,
                                marginLeft: medalRing ? 4 : 2,
                                border: isTied && !medalRing ? `1.5px solid ${tierColor}55` : 'none',
                              }}
                            >
                              <span style={{
                                fontFamily: "'Fraunces', serif",
                                fontWeight: 900,
                                fontSize: 13,
                                lineHeight: 1,
                                letterSpacing: -0.5,
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {displayRank}
                              </span>
                              {isTied && (
                                <span style={{
                                  fontSize: 7.5,
                                  opacity: 0.75,
                                  lineHeight: 1,
                                  marginTop: 1,
                                  fontVariantNumeric: 'tabular-nums',
                                  fontWeight: 500,
                                  letterSpacing: 0.2,
                                }}>
                                  ⌀{frac.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {/* Rendering rule for the group's films:
                                • ≤ 2 films  → each film is a unified card
                                               with the poster on the left and
                                               the title inline on the right.
                                               Pairs wrap on narrow screens.
                                • 3+ films   → compact tier-list look: posters
                                               side-by-side with a tiny title
                                               under each. The poster + title
                                               share one card so the link is
                                               visually unambiguous. */}
                            {(() => {
                              // Inline mode (poster + title to the right) only
                              // for solo and 2-tied — from 3 films the compact
                              // tier-list look (title under each poster) stays
                              // readable and avoids squeezing three columns.
                              const showInline = g.items.length <= 2
                              const effCardW = showInline ? 27 : cardW
                              const effCloseSz = showInline ? 11 : closeSz
                              const effCloseFs = showInline ? 8 : closeFs
                              return (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: showInline ? 8 : cardGap, flex: 1, alignItems: 'stretch' }}>
                                  {g.items.map(rankItem => {
                                    const item = getItem(rankItem.id)
                                    if (!item) return null
                                    const isDragging = tierDragId === rankItem.id
                                    const posterInner = (
                                      <div style={{ position: 'relative', width: effCardW, flexShrink: 0, aspectRatio: '2 / 3', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                                        {item.cover ? (
                                          <img src={item.cover} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        ) : (
                                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: showInline ? 11 : placeholderFs, color: 'var(--fg-7)' }}>
                                            {item.prefix ?? item.label.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <button
                                          onClick={ev => { ev.stopPropagation(); removeFromList(rankItem.id) }}
                                          style={{ position: 'absolute', top: 2, right: 2, width: effCloseSz, height: effCloseSz, borderRadius: effCloseSz / 2, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: effCloseFs, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                        >×</button>
                                      </div>
                                    )
                                    const dragProps = {
                                      draggable: true,
                                      onClick: () => { setMoveCardId(rankItem.id); setMoveTier(null) },
                                      onDragStart: (ev: React.DragEvent) => { ev.stopPropagation(); setTierDragId(rankItem.id) },
                                      onDragEnd: () => { setTierDragId(null); setDragOverTier(null); setDragOverSlot(null) },
                                      title: item.label,
                                    }
                                    const unifiedCardStyle: React.CSSProperties = {
                                      background: 'var(--bg-card)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 6,
                                      overflow: 'hidden',
                                      cursor: 'grab',
                                      opacity: isDragging ? 0.4 : 1,
                                      userSelect: 'none',
                                      transition: 'opacity .1s, border-color .1s',
                                    }
                                    if (showInline) {
                                      // Flex-grow fills the whole row width:
                                      // 1 solo card → takes everything;
                                      // 2 tied → half each. Max-width caps
                                      // very wide screens so titles don't get
                                      // marooned 1000px apart.
                                      const solo = g.items.length === 1
                                      return (
                                        <div key={rankItem.id} {...dragProps} style={{ ...unifiedCardStyle, display: 'flex', alignItems: 'stretch', flex: '1 1 0', minWidth: 220, maxWidth: solo ? 900 : 480 }}>
                                          {posterInner}
                                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, padding: '0 10px', gap: 6 }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                                              {item.label}
                                            </span>
                                            {item.year != null && (
                                              <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                                {item.year}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    }
                                    return (
                                      <div key={rankItem.id} {...dragProps} style={{ ...unifiedCardStyle, display: 'flex', flexDirection: 'column', width: cardW }}>
                                        {posterInner}
                                        <div style={{ padding: '2px 3px 3px', fontSize: 8.5, color: 'var(--fg-4)', lineHeight: 1.15, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {item.label}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })()}
                          </div>
                          {renderInsertZone(nextRank, `after-${g.rank}`)}
                        </React.Fragment>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )
        })}

      </div>

      {/* Sticky bottom: search/add bar + unclassified strip below */}
      <div style={{ position: 'sticky', bottom: 0, marginTop: 24, marginLeft: -12, marginRight: -12, padding: '14px 16px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px 14px 0 0', boxShadow: '0 -8px 28px rgba(0,0,0,.10)', zIndex: 20 }}>
        {addError && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 8, color: 'var(--error-text)', fontSize: 13 }}>{addError}</div>
        )}
        {/* Search bar always renders. Adding a NEW film to the catalog is a
            server action, so the year input + submit button are gated behind
            a session — guests can still filter the existing catalog. */}
        {(() => {
          const SearchInput = (
            <input
              name={addFormAction ? 'title' : undefined}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              required={!!addFormAction}
              autoComplete="off"
              className="rank-add-title"
              style={{ flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s, box-shadow .15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-fg)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-faint)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          )
          const DecadeFilter = hasYearData ? (
            <EditorDecadeDropdown
              decadeCounts={decadeCounts}
              decade={decadeFilter}
              setDecade={setDecadeFilter}
            />
          ) : null
          const TopFilterEl = hasRatings ? (
            <EditorTopDropdown top={topFilter} setTop={setTopFilter} />
          ) : null
          if (addFormAction) {
            return (
              <form action={addFormAction} className="rank-add-form" style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 10 }}>
                {SearchInput}
                {DecadeFilter}
                {TopFilterEl}
                <input
                  name="year"
                  type="number"
                  min={1888}
                  max={2099}
                  placeholder="Année"
                  className="rank-add-year"
                  style={{ width: 90, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                />
                <button type="submit" disabled={addPending || !search.trim()} title="Si le titre n'est pas dans la liste, ajoute-le au site" className="rank-add-submit" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1, padding: '6px 18px', borderRadius: 9, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', cursor: addPending || !search.trim() ? 'default' : 'pointer', opacity: addPending || !search.trim() ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '.05em' }}>Pas dans la liste&nbsp;?</span>
                  <span style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>{addPending ? '…' : '+ Ajoute-le'}</span>
                </button>
              </form>
            )
          }
          return (
            <div className="rank-add-form" style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 10 }}>
              {SearchInput}
              {DecadeFilter}
              {TopFilterEl}
            </div>
          )
        })()}
        {(() => {
          const matchesSearch = (item: RankableItem) => !search.trim() || normalizeTitle(item.label).includes(normalizeTitle(search))
          const matchesDecade = (item: RankableItem) => decadeFilter === null || (item.year !== null && item.year !== undefined && Math.floor(item.year / 10) * 10 === decadeFilter)
          const matchesTop = (item: RankableItem) => topIds === null || topIds.has(item.id)
          const unclassifiedRaw = items.filter(item => !tierItems.some(i => i.id === item.id) && matchesSearch(item) && matchesDecade(item) && matchesTop(item))
          // Default ordering: best-ranked community picks first, so a new
          // user sees the most-valuable films to classify. Unrated films
          // (score === 0 and no votes) fall to the bottom in catalog order.
          // When a top filter is active we respect its metric explicitly.
          const unclassified = topFilter === null
            ? [...unclassifiedRaw].sort((a, b) => {
                const sa = a.score ?? 0
                const sb = b.score ?? 0
                if (sb !== sa) return sb - sa
                return (b.tierCount ?? 0) - (a.tierCount ?? 0)
              })
            : [...unclassifiedRaw].sort((a, b) => {
                const ka = topFilter.kind === 'popular' ? (a.tierCount ?? 0) : (a.score ?? 0)
                const kb = topFilter.kind === 'popular' ? (b.tierCount ?? 0) : (b.score ?? 0)
                return kb - ka
              })
          // Always cap: with 2000+ entries, even a short search prefix can
          // match hundreds, and rendering that many cover images per keystroke
          // locks up the browser. The "Load more" button below lets the user
          // walk past the cap when they want to.
          const visibleUnclassified = unclassified.slice(0, unclassifiedLimit)
          const totalUnclassified = items.filter(item => !tierItems.some(i => i.id === item.id)).length
          const filterActive = !!search.trim() || decadeFilter !== null || topFilter !== null
          const filterHints: string[] = []
          if (decadeFilter !== null) filterHints.push(`années ${decadeFilter}`)
          if (topFilter !== null) filterHints.push(topFilter.kind === 'popular' ? `top ${topFilter.count} populaires` : `top ${topFilter.count} mieux notés`)
          const labelText = filterActive
            ? `${unclassified.length} résultat${unclassified.length !== 1 ? 's' : ''}${filterHints.length > 0 ? ` · ${filterHints.join(' · ')}` : ''}`
            : (totalUnclassified === 0
                ? t.allClassified
                : `${totalUnclassified} ${totalUnclassified > 1 ? 'films restent à classer' : 'film reste à classer'}`)
          return (
            <>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', marginBottom: 5 }}>
                {labelText}
              </div>
              <div
                onDragOver={ev => ev.preventDefault()}
                onDrop={() => { if (tierDragId) dropOnUnclassified(tierDragId); setTierDragId(null); setDragOverTier(null) }}
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 5, minHeight: visibleUnclassified.length === 0 ? 0 : 70 }}
              >
              {visibleUnclassified.length === 0 ? (
                filterActive ? (
                  <span style={{ color: 'var(--fg-5)', fontSize: 12, fontStyle: 'italic' }}>
                    {search.trim() ? (
                      <>
                        « {search} » n&apos;est pas dans les résultats
                        {addFormAction ? (
                          <> — utilise <strong style={{ color: 'var(--fg-4)' }}>Ajoute-le</strong> au-dessus.</>
                        ) : (
                          <> — connecte-toi pour l&apos;ajouter au catalogue.</>
                        )}
                      </>
                    ) : (
                      <>Aucun film restant pour ce filtre.</>
                    )}
                  </span>
                ) : null
              ) : (
                visibleUnclassified.map(item => (
                  <div key={item.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      draggable
                      onClick={() => {
                        setQuickAddId(prev => prev === item.id ? null : item.id)
                        setQuickAddTier(null)
                      }}
                      onDragStart={() => { setTierDragId(item.id); setQuickAddId(null) }}
                      onDragEnd={() => { setTierDragId(null); setDragOverTier(null) }}
                      title={item.label}
                      style={{ width: 44, background: 'var(--bg-card)', border: `1px solid ${quickAddId === item.id ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 4, padding: 2, cursor: 'grab', opacity: tierDragId === item.id ? 0.4 : 1, userSelect: 'none', transition: 'opacity .1s, border-color .1s' }}
                    >
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3', background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                        {item.cover ? (
                          <img src={item.cover} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 14, color: 'var(--fg-7)' }}>
                            {item.prefix ?? item.label.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    {quickAddId === item.id && quickAddTier === null && (
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 30, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, padding: 6, boxShadow: '0 -6px 20px rgba(0,0,0,.18)', display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                        {TIERS.map(tier => {
                          const hasItems = tierItems.some(i => i.tier === tier && i.id !== item.id)
                          return (
                            <button
                              key={tier}
                              onClick={ev => {
                                ev.stopPropagation()
                                if (hasItems) {
                                  setQuickAddTier(tier)
                                } else {
                                  dropOnTier(item.id, tier, { kind: 'insert', beforeRank: null })
                                  setQuickAddId(null)
                                  setQuickAddTier(null)
                                }
                              }}
                              style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${TIER_COLOR[tier]}55`, background: `${TIER_COLOR[tier]}18`, color: TIER_COLOR[tier], fontSize: 11, fontFamily: "'Fraunces', serif", fontWeight: 700, cursor: 'pointer' }}
                            >{tier}</button>
                          )
                        })}
                      </div>
                    )}
                    {quickAddId === item.id && quickAddTier !== null && (() => {
                      const tier = quickAddTier
                      const inTier = tierItems
                        .filter(i => i.tier === tier && i.id !== item.id)
                        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                      // Build rank groups for the picker
                      const groups: Array<{ rank: number; items: RankEditItem[] }> = []
                      for (const i of inTier) {
                        const r = i.position ?? 1
                        const last = groups[groups.length - 1]
                        if (last && last.rank === r) last.items.push(i)
                        else groups.push({ rank: r, items: [i] })
                      }
                      const tierColor = TIER_COLOR[tier]
                      const commit = (op: DropOp) => {
                        dropOnTier(item.id, tier, op)
                        setQuickAddId(null); setQuickAddTier(null)
                      }
                      return (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 30, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, padding: 8, boxShadow: '0 -6px 20px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 220, maxHeight: 280, overflowY: 'auto' }}>
                          <div style={{ fontSize: 10, color: 'var(--fg-6)', marginBottom: 2 }}>
                            Rang dans <span style={{ color: tierColor, fontWeight: 600 }}>{TIER_LABEL[tier]}</span> :
                          </div>
                          <button
                            onClick={ev => { ev.stopPropagation(); commit({ kind: 'insert', beforeRank: groups[0]?.rank ?? null }) }}
                            style={{ alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 5, border: `1px solid ${tierColor}55`, background: `${tierColor}10`, color: tierColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Nouveau rang en tête (#1)
                          </button>
                          {groups.map((g, gIdx) => {
                            const names = g.items.map(x => getItem(x.id)?.label ?? '').filter(Boolean)
                            const sampleTitle = names.slice(0, 2).join(', ') + (names.length > 2 ? '…' : '')
                            const nextRank = groups[gIdx + 1]?.rank ?? null
                            return (
                              <React.Fragment key={g.rank}>
                                <button
                                  onClick={ev => { ev.stopPropagation(); commit({ kind: 'join', rank: g.rank }) }}
                                  style={{ alignSelf: 'stretch', padding: '3px 9px', borderRadius: 5, border: `1px dashed ${tierColor}55`, background: `${tierColor}05`, color: tierColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                >
                                  = Même rang #{g.rank} que {sampleTitle}
                                </button>
                                <button
                                  onClick={ev => { ev.stopPropagation(); commit({ kind: 'insert', beforeRank: nextRank }) }}
                                  style={{ alignSelf: 'stretch', padding: '3px 9px', borderRadius: 5, border: `1px solid ${tierColor}55`, background: `${tierColor}10`, color: tierColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                >
                                  {nextRank === null
                                    ? `Nouveau rang en dernier (#${g.rank + 1})`
                                    : `Nouveau rang entre #${g.rank} et #${nextRank}`}
                                </button>
                              </React.Fragment>
                            )
                          })}
                          <button
                            onClick={ev => { ev.stopPropagation(); setQuickAddTier(null) }}
                            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 10, fontFamily: 'inherit', marginTop: 2 }}
                          >
                            ← Changer de tier
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                ))
              )}
              {unclassified.length > unclassifiedLimit && (
                <button
                  onClick={() => setUnclassifiedLimit(c => c + 18)}
                  style={{ alignSelf: 'center', marginLeft: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-6)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  +{Math.min(18, unclassified.length - unclassifiedLimit)} ({unclassified.length - unclassifiedLimit} restants)
                </button>
              )}
              </div>
            </>
          )
        })()}
      </div>

      {/* Move modal — replaces drag-and-drop on touch devices */}
      {moveCardId && (() => {
        const card = tierItems.find(i => i.id === moveCardId)
        const item = card ? getItem(card.id) : null
        if (!card || !item) return null
        const currentTier = card.tier
        const close = () => { setMoveCardId(null); setMoveTier(null) }
        const targetTier = moveTier ?? currentTier ?? null
        const inTarget = targetTier
          ? tierItems
              .filter(i => i.tier === targetTier && i.id !== card.id)
              .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          : []
        const targetGroups: Array<{ rank: number; items: RankEditItem[] }> = []
        for (const i of inTarget) {
          const r = i.position ?? 1
          const last = targetGroups[targetGroups.length - 1]
          if (last && last.rank === r) last.items.push(i)
          else targetGroups.push({ rank: r, items: [i] })
        }
        const targetColor = targetTier ? TIER_COLOR[targetTier] : 'var(--border)'
        return (
          <div
            onClick={close}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '85vh', boxShadow: '0 -10px 40px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {/* Sticky header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.cover && <img src={item.cover} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--fg-6)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Déplacer</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, marginTop: 1 }}>{item.label}</div>
                  {currentTier && (
                    <div style={{ fontSize: 11, color: TIER_COLOR[currentTier], marginTop: 2 }}>
                      {TIER_LABEL[currentTier]}
                      {card.position !== undefined ? ` · #${card.position}` : ''}
                    </div>
                  )}
                </div>
                <button onClick={close} aria-label="Fermer" style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--fg-6)', cursor: 'pointer', lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {/* Tier picker */}
                <div style={{ fontSize: 10, color: 'var(--fg-6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Mention</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                  {TIERS.map(tier => {
                    const isCurrent = tier === targetTier
                    const c = TIER_COLOR[tier]
                    return (
                      <button
                        key={tier}
                        onClick={() => { setMoveTier(tier) }}
                        style={{ padding: '6px 11px', borderRadius: 6, border: `1px solid ${isCurrent ? c : c + '55'}`, background: isCurrent ? `${c}25` : `${c}0d`, color: c, fontSize: 12, fontFamily: "'Fraunces', serif", fontWeight: 700, cursor: 'pointer' }}
                      >
                        {TIER_LABEL[tier]}
                      </button>
                    )
                  })}
                </div>

                {/* Rank-slot picker */}
                {targetTier && (
                  <>
                    <div style={{ fontSize: 10, color: 'var(--fg-6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
                      Rang dans {TIER_LABEL[targetTier]}
                    </div>
                    {targetGroups.length === 0 ? (
                      <button
                        onClick={() => { dropOnTier(card.id, targetTier!, { kind: 'insert', beforeRank: null }); close() }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: `1.5px dashed ${targetColor}`, background: `${targetColor}10`, color: targetColor, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center' }}
                      >
                        ＋ Premier au rang #1
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {/* Insert zone at the very top */}
                        <button
                          onClick={() => { dropOnTier(card.id, targetTier!, { kind: 'insert', beforeRank: targetGroups[0].rank }); close() }}
                          style={{ padding: '7px 10px', borderRadius: 6, border: `1.5px dashed ${targetColor}66`, background: `${targetColor}0a`, color: targetColor, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 4 }}
                        >
                          ＋ Nouveau rang en tête
                        </button>
                        {targetGroups.map((g, gIdx) => {
                          const nextRank = targetGroups[gIdx + 1]?.rank ?? null
                          const isTied = g.items.length > 1
                          return (
                            <React.Fragment key={g.rank}>
                              {/* Join target: looks like a group row from the editor */}
                              <button
                                onClick={() => { dropOnTier(card.id, targetTier!, { kind: 'join', rank: g.rank }); close() }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '6px 8px', borderRadius: 7,
                                  border: `1px solid ${targetColor}44`,
                                  background: isTied ? `${targetColor}0f` : 'var(--bg-subtle)',
                                  color: 'var(--fg-3)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                                  marginBottom: 4,
                                }}
                              >
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 30, height: 30, borderRadius: 999,
                                  background: targetColor, color: '#fff',
                                  fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 15,
                                  flexShrink: 0,
                                }}>
                                  {g.rank}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 10, color: targetColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                    = Même rang
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                                    avec {g.items.map(x => getItem(x.id)?.label ?? '').filter(Boolean).join(', ')}
                                  </div>
                                </div>
                                {/* Mini poster(s) */}
                                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                  {g.items.slice(0, 3).map(it => {
                                    const im = getItem(it.id)
                                    return im?.cover ? (
                                      <img key={it.id} src={im.cover} alt="" style={{ width: 20, height: 30, objectFit: 'cover', borderRadius: 2 }} />
                                    ) : null
                                  })}
                                </div>
                              </button>
                              {/* Insert zone after this group */}
                              <button
                                onClick={() => { dropOnTier(card.id, targetTier!, { kind: 'insert', beforeRank: nextRank }); close() }}
                                style={{ padding: '7px 10px', borderRadius: 6, border: `1.5px dashed ${targetColor}66`, background: `${targetColor}0a`, color: targetColor, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 4 }}
                              >
                                {nextRank === null
                                  ? `＋ Nouveau rang en dernier`
                                  : `＋ Nouveau rang entre #${g.rank} et #${nextRank}`}
                              </button>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sticky footer */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { removeFromList(card.id); close() }}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0555544', background: '#e0555518', color: '#e05555', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  🗑 Retirer de la liste
                </button>
                <button onClick={close} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-4)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
