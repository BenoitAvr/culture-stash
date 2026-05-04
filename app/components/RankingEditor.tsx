'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/dictionaries/client'

export type RankableItem = {
  id: string
  label: string
  prefix?: string
  suffix?: string
  cover?: string | null
}

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
  const [tierRankedTiers, setTierRankedTiers] = useState(new Set<string>(initialRankedTiers))

  const [isPending, setIsPending] = useState(false)

  const [tierDragId, setTierDragId] = useState<string | null>(null)
  const [dragOverTier, setDragOverTier] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<{ matched: RankEditItem[]; unmatched: string[] } | null>(null)
  const [search, setSearch] = useState('')
  const [quickAddId, setQuickAddId] = useState<string | null>(null)
  const [quickAddTier, setQuickAddTier] = useState<string | null>(null)
  const [unclassifiedLimit, setUnclassifiedLimit] = useState(18)
  const wasPendingRef = useRef(false)
  useEffect(() => {
    if (wasPendingRef.current && !addPending && !addError) setSearch('')
    wasPendingRef.current = addPending ?? false
  }, [addPending, addError])

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
        matched.push({ id: item.id, tier: currentTier, position: tierPos })
      } else if (!item) {
        unmatched.push(title)
      }
    }
    setImportResult({ matched, unmatched })
  }

  function handleConfirmImport() {
    if (!importResult) return
    setTierItems(importResult.matched)
    setIsImporting(false)
    setImportText('')
    setImportResult(null)
  }

  function dropOnTier(id: string, tier: string, insertBeforeId?: string | null) {
    setTierItems(prev => {
      const existing = prev.find(i => i.id === id)
      const oldTier = existing?.tier
      const isRanked = tierRankedTiers.has(tier)

      if (isRanked && insertBeforeId !== undefined) {
        const sameTierWithoutMoved = prev.filter(i => i.tier === tier && i.id !== id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        const insertIdx = insertBeforeId === null
          ? sameTierWithoutMoved.length
          : sameTierWithoutMoved.findIndex(i => i.id === insertBeforeId)
        const idxOrEnd = insertIdx === -1 ? sameTierWithoutMoved.length : insertIdx
        const newTierItems = [
          ...sameTierWithoutMoved.slice(0, idxOrEnd),
          { id, tier, position: 0 },
          ...sameTierWithoutMoved.slice(idxOrEnd),
        ].map((it, i) => ({ ...it, tier, position: i + 1 }))
        let result = [
          ...prev.filter(i => i.tier !== tier && i.id !== id),
          ...newTierItems,
        ]
        if (oldTier && oldTier !== tier && tierRankedTiers.has(oldTier)) {
          let pos = 1
          result = result.map(i => i.tier === oldTier ? { ...i, position: pos++ } : i)
        }
        return result
      }

      if (oldTier === tier) return prev
      const tierCount = prev.filter(i => i.tier === tier && i.id !== id).length
      const position = isRanked ? tierCount + 1 : undefined
      let updated: RankEditItem[] = existing
        ? prev.map(i => i.id === id ? { ...i, tier, position } : i)
        : [...prev, { id, tier, position }]
      if (oldTier && tierRankedTiers.has(oldTier)) {
        let pos = 1
        updated = updated.map(i => i.tier === oldTier ? { ...i, position: pos++ } : i)
      }
      return updated
    })
  }

  function dropOnUnclassified(id: string) {
    setTierItems(prev => {
      const item = prev.find(i => i.id === id)
      const oldTier = item?.tier
      if (!item || !oldTier) return prev
      const removed = prev.filter(i => i.id !== id)
      if (tierRankedTiers.has(oldTier)) {
        let pos = 1
        return removed.map(i => i.tier === oldTier ? { ...i, position: pos++ } : i)
      }
      return removed
    })
  }

  function reorderWithinTier(tier: string, fromId: string, toId: string) {
    setTierItems(prev => {
      const inTier = prev.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const other = prev.filter(i => i.tier !== tier)
      const fromIdx = inTier.findIndex(i => i.id === fromId)
      const toIdx = inTier.findIndex(i => i.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = inTier.splice(fromIdx, 1)
      inTier.splice(toIdx, 0, moved)
      return [...other, ...inTier.map((item, i) => ({ ...item, position: i + 1 }))]
    })
  }

  function toggleTierRanking(tier: string) {
    const willBeRanked = !tierRankedTiers.has(tier)
    setTierRankedTiers(prev => { const s = new Set(prev); if (willBeRanked) s.add(tier); else s.delete(tier); return s })
    if (willBeRanked) {
      setTierItems(prev => { let pos = 1; return prev.map(i => i.tier === tier ? { ...i, position: pos++ } : i) })
    } else {
      setTierItems(prev => prev.map(i => i.tier === tier ? { ...i, position: undefined } : i))
    }
  }

  function handleSave() {
    setIsPending(true)
    onSave(tierItems, [...tierRankedTiers]).finally(() => setIsPending(false))
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>
          {hasExisting ? t.editListTitle : t.createListTitle}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {!isImporting && (
          <button onClick={() => setIsImporting(true)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-6)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
            ↑ Importer
          </button>
        )}
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-7)', fontFamily: 'inherit' }}>{t.cancel}</button>
        <button onClick={handleSave} disabled={isPending} style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1 }}>
          {isPending ? t.saving : t.save}
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
        {TIERS.map(tier => {
          const inTier = tierItems.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          const isRankedTier = tierRankedTiers.has(tier)
          const isDropTarget = dragOverTier === tier
          const tierOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce((sum, t) => sum + tierItems.filter(i => i.tier === t).length, 0)
          const cardW = 62
          const placeholderFs = 18
          const closeSz = 16
          const closeFs = 11
          const emblemSz = 24
          const emblemFs = 12
          const emblemOff = -6
          const emblemBw = 2
          const titleFs = 10
          const titleClamp = 1
          const yearFs = 9
          const cardPad = 3
          const cardGap = 5
          const isExpanded = hoveredTier === tier || isDropTarget
          const collapsedMaxH = 145
          return (
            <div
              key={tier}
              onMouseEnter={() => setHoveredTier(tier)}
              onMouseLeave={() => setHoveredTier(prev => prev === tier ? null : prev)}
              style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginBottom: 10 }}
            >
              <div style={{ width: 64, minHeight: 60, borderRadius: 7, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 10, color: TIER_COLOR[tier], flexShrink: 0, textAlign: 'center', padding: '0 6px' }}>
                {TIER_LABEL[tier]}
              </div>
              <div
                onDragOver={ev => { ev.preventDefault(); setDragOverTier(tier) }}
                onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setDragOverTier(null) }}
                onDrop={ev => {
                  ev.preventDefault()
                  if (tierDragId) {
                    const fromTier = tierItems.find(i => i.id === tierDragId)?.tier
                    if (fromTier !== tier) dropOnTier(tierDragId, tier)
                  }
                  setDragOverTier(null); setTierDragId(null)
                }}
                style={{ flex: 1, minHeight: 60, maxHeight: isExpanded ? 4000 : collapsedMaxH, overflow: 'hidden', background: isDropTarget ? 'var(--accent-faint)' : 'var(--bg-card)', border: `1px dashed ${isDropTarget ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 7, padding: '12px 8px 8px', display: 'flex', flexWrap: 'wrap', gap: cardGap, alignItems: 'flex-start', alignContent: 'flex-start', transition: 'background .12s, border-color .12s, max-height .25s ease' }}
              >
                {inTier.length === 0 && <span style={{ color: 'var(--fg-6)', fontSize: 12, fontStyle: 'italic', alignSelf: 'center' }}>← glisser ici</span>}
                {inTier.map((rankItem, idx) => {
                  const item = getItem(rankItem.id)
                  if (!item) return null
                  const isDragging = tierDragId === rankItem.id
                  const isOver = isRankedTier && dragOverItemId === rankItem.id
                  const position = isRankedTier ? tierOffset + idx + 1 : undefined
                  return (
                    <div key={rankItem.id}
                      draggable
                      onDragStart={ev => { ev.stopPropagation(); setTierDragId(rankItem.id) }}
                      onDragOver={isRankedTier ? ev => { ev.preventDefault(); ev.stopPropagation(); if (!isDragging) setDragOverItemId(rankItem.id) } : undefined}
                      onDragLeave={isRankedTier ? () => setDragOverItemId(prev => prev === rankItem.id ? null : prev) : undefined}
                      onDrop={isRankedTier ? ev => {
                        ev.preventDefault(); ev.stopPropagation()
                        if (tierDragId && tierDragId !== rankItem.id) {
                          const fromTier = tierItems.find(i => i.id === tierDragId)?.tier
                          if (fromTier === tier) reorderWithinTier(tier, tierDragId, rankItem.id)
                          else dropOnTier(tierDragId, tier)
                        }
                        setDragOverTier(null); setDragOverItemId(null); setTierDragId(null)
                      } : undefined}
                      onDragEnd={() => { setTierDragId(null); setDragOverTier(null); setDragOverItemId(null) }}
                      title={item.label}
                      style={{ position: 'relative', width: cardW, flexShrink: 0, background: 'var(--bg-card)', border: `1px solid ${isOver ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 6, padding: cardPad, cursor: 'grab', opacity: isDragging ? 0.4 : 1, userSelect: 'none', transition: 'border-color .1s, opacity .1s' }}
                    >
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3', background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                        {item.cover ? (
                          <img src={item.cover} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: placeholderFs, color: 'var(--fg-7)' }}>
                            {item.prefix ?? item.label.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <button
                          onClick={ev => {
                            ev.stopPropagation()
                            if (isRankedTier) {
                              setTierItems(prev => { const r = prev.filter(i => i.id !== rankItem.id); let pos = 1; return r.map(i => i.tier === tier ? { ...i, position: pos++ } : i) })
                            } else {
                              setTierItems(prev => prev.filter(i => i.id !== rankItem.id))
                            }
                          }}
                          style={{ position: 'absolute', top: 3, right: 3, width: closeSz, height: closeSz, borderRadius: closeSz / 2, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: closeFs, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >×</button>
                      </div>
                      {position !== undefined && (
                        <div style={{ position: 'absolute', top: emblemOff, left: emblemOff, minWidth: emblemSz, height: emblemSz, padding: `0 ${Math.round(emblemSz * 0.24)}px`, borderRadius: emblemSz / 2, background: position <= 3 ? 'var(--accent-fg)' : '#1a1a1a', color: position <= 3 ? 'var(--btn-text)' : '#fff', border: `${emblemBw}px solid var(--bg-card)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: emblemFs, fontWeight: 800, fontFamily: "'Fraunces', serif", boxShadow: '0 3px 8px rgba(0,0,0,.4)', zIndex: 3 }}>
                          {position}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: titleFs, color: 'var(--fg-3)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: titleClamp, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                        {item.label}
                      </div>
                      {item.suffix && (
                        <div style={{ fontSize: yearFs, color: 'var(--fg-6)', marginTop: 1 }}>{item.suffix}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => toggleTierRanking(tier)}
                title="Classer par rang à l'intérieur de ce tier"
                style={{ alignSelf: 'flex-start', marginTop: 6, padding: '5px 11px', borderRadius: 6, border: `1px solid ${isRankedTier ? 'var(--accent-muted)' : 'var(--border)'}`, background: isRankedTier ? 'var(--accent-faint)' : 'var(--bg-subtle)', color: isRankedTier ? 'var(--accent-fg)' : 'var(--fg-5)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}
              >
                {isRankedTier ? '# classé' : '# ranger'}
              </button>
            </div>
          )
        })}

      </div>

      {/* Sticky bottom: search/add bar + unclassified strip below */}
      <div style={{ position: 'sticky', bottom: 0, marginTop: 24, marginLeft: -12, marginRight: -12, padding: '14px 16px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px 14px 0 0', boxShadow: '0 -8px 28px rgba(0,0,0,.10)', zIndex: 20 }}>
        {addError && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 8, color: 'var(--error-text)', fontSize: 13 }}>{addError}</div>
        )}
        {addFormAction && (
          <form action={addFormAction} style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 10 }}>
            <input
              name="title"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              required
              autoComplete="off"
              style={{ flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s, box-shadow .15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-fg)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-faint)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <input
              name="year"
              type="number"
              min={1888}
              max={2099}
              placeholder="Année"
              style={{ width: 90, padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
            />
            <button type="submit" disabled={addPending || !search.trim()} title="Si le titre n'est pas dans la liste, ajoute-le au site" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1, padding: '6px 18px', borderRadius: 9, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', cursor: addPending || !search.trim() ? 'default' : 'pointer', opacity: addPending || !search.trim() ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '.05em' }}>Pas dans la liste&nbsp;?</span>
              <span style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>{addPending ? '…' : '+ Ajoute-le'}</span>
            </button>
          </form>
        )}
        {(() => {
          const unclassified = items.filter(item => !tierItems.some(i => i.id === item.id) && (!search.trim() || normalizeTitle(item.label).includes(normalizeTitle(search))))
          const visibleUnclassified = search.trim() ? unclassified : unclassified.slice(0, unclassifiedLimit)
          const totalUnclassified = items.filter(item => !tierItems.some(i => i.id === item.id)).length
          const labelText = search.trim()
            ? `${unclassified.length} résultat${unclassified.length !== 1 ? 's' : ''}`
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
                search.trim() && addFormAction ? (
                  <span style={{ color: 'var(--fg-5)', fontSize: 12, fontStyle: 'italic' }}>
                    « {search} » n&apos;est pas dans la liste — utilise <strong style={{ color: 'var(--fg-4)' }}>Ajoute-le</strong> au-dessus.
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
                          const isRanked = tierRankedTiers.has(tier)
                          const hasItems = tierItems.some(i => i.tier === tier && i.id !== item.id)
                          return (
                            <button
                              key={tier}
                              onClick={ev => {
                                ev.stopPropagation()
                                if (isRanked && hasItems) {
                                  setQuickAddTier(tier)
                                } else {
                                  dropOnTier(item.id, tier)
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
                      const positionItems = tierItems
                        .filter(i => i.tier === tier && i.id !== item.id)
                        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                      const tierColor = TIER_COLOR[tier]
                      return (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 30, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, padding: 8, boxShadow: '0 -6px 20px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 200, maxHeight: 280, overflowY: 'auto' }}>
                          <div style={{ fontSize: 10, color: 'var(--fg-6)', marginBottom: 2 }}>
                            Position dans <span style={{ color: tierColor, fontWeight: 600 }}>{TIER_LABEL[tier]}</span> :
                          </div>
                          <button
                            onClick={ev => {
                              ev.stopPropagation()
                              dropOnTier(item.id, tier, null)
                              setQuickAddId(null); setQuickAddTier(null)
                            }}
                            style={{ alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 5, border: `1px solid ${tierColor}55`, background: `${tierColor}10`, color: tierColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            En dernier (#{positionItems.length + 1})
                          </button>
                          {positionItems.map((p, idx) => {
                            const it = getItem(p.id)
                            return (
                              <button
                                key={p.id}
                                onClick={ev => {
                                  ev.stopPropagation()
                                  dropOnTier(item.id, tier, p.id)
                                  setQuickAddId(null); setQuickAddTier(null)
                                }}
                                style={{ alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 5, border: `1px solid ${tierColor}55`, background: `${tierColor}10`, color: tierColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                              >
                                Avant « {it?.label ?? p.id} » (#{idx + 1})
                              </button>
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
              {!search.trim() && unclassified.length > unclassifiedLimit && (
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

    </div>
  )
}
