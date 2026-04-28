'use client'

import { useState } from 'react'
import type { Dict } from '@/dictionaries/client'

export type RankableItem = {
  id: string
  label: string
  prefix?: string  // emoji for resources
  suffix?: string  // year for entries
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

export function RankingEditor({
  items,
  initialRankItems,
  initialTierItems,
  initialMode,
  initialRankedTiers,
  hasExisting,
  onSave,
  onCancel,
  onDelete,
  t,
}: {
  items: RankableItem[]
  initialRankItems: RankEditItem[]
  initialTierItems: RankEditItem[]
  initialMode: 'RANKED' | 'TIER'
  initialRankedTiers: string[]
  hasExisting: boolean
  onSave: (mode: 'RANKED' | 'TIER', rank: RankEditItem[], tier: RankEditItem[], rankedTiers: string[]) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  t: Dict['rankings']
}) {
  const [mode, setMode] = useState<'RANKED' | 'TIER'>(initialMode)
  const [rankItems, setRankItems] = useState<RankEditItem[]>(initialRankItems)
  const [tierItems, setTierItems] = useState<RankEditItem[]>(initialTierItems)
  const [tierRankedTiers, setTierRankedTiers] = useState(new Set<string>(initialRankedTiers))
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [tierDragId, setTierDragId] = useState<string | null>(null)
  const [dragOverTier, setDragOverTier] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<{ matched: RankEditItem[]; unmatched: string[] } | null>(null)

  const currentListEmpty = mode === 'RANKED' ? rankItems.length === 0 : tierItems.length === 0

  const getItem = (id: string) => items.find(e => e.id === id)

  function findItem(title: string): RankableItem | null {
    const norm = normalizeTitle(title)
    const exact = items.find(e => normalizeTitle(e.label) === norm)
    if (exact) return exact
    return items.find(e => {
      const en = normalizeTitle(e.label)
      if (en.length < 4 || norm.length < 4) return false
      return en.includes(norm) || norm.includes(en)
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

    if (mode === 'RANKED') {
      const matched: RankEditItem[] = []
      const unmatched: string[] = []
      let pos = 0
      for (const line of lines) {
        const numMatch = line.match(/^(\d+)\s*[:.)\-]\s*(.+)$/)
        const title = numMatch ? numMatch[2].trim() : line
        pos = numMatch ? parseInt(numMatch[1]) : pos + 1
        const item = findItem(title)
        if (item && !matched.find(i => i.id === item.id)) {
          matched.push({ id: item.id, position: pos })
        } else if (!item) {
          unmatched.push(title)
        }
      }
      setImportResult({ matched, unmatched })
    } else {
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
  }

  function handleConfirmImport() {
    if (!importResult) return
    if (mode === 'RANKED') {
      setRankItems(importResult.matched.map((item, i) => ({ ...item, position: i + 1 })))
    } else {
      setTierItems(importResult.matched)
    }
    setIsImporting(false)
    setImportText('')
    setImportResult(null)
  }

  function addRanked(id: string) {
    if (rankItems.some(i => i.id === id)) return
    setRankItems(prev => [...prev, { id, position: prev.length + 1 }])
  }
  function removeRanked(id: string) {
    setRankItems(prev => prev.filter(i => i.id !== id).map((item, idx) => ({ ...item, position: idx + 1 })))
  }
  function reorder(fromId: string, toId: string) {
    setRankItems(prev => {
      const arr = [...prev]
      const fromIdx = arr.findIndex(i => i.id === fromId)
      const toIdx = arr.findIndex(i => i.id === toId)
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return arr.map((item, i) => ({ ...item, position: i + 1 }))
    })
  }
  function updateRankNote(id: string, note: string) {
    setRankItems(prev => prev.map(i => i.id === id ? { ...i, note: note || undefined } : i))
  }

  function dropOnTier(id: string, tier: string) {
    setTierItems(prev => {
      const existing = prev.find(i => i.id === id)
      const oldTier = existing?.tier
      if (oldTier === tier) return prev
      const tierCount = prev.filter(i => i.tier === tier && i.id !== id).length
      const position = tierRankedTiers.has(tier) ? tierCount + 1 : undefined
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
  function updateTierNote(id: string, note: string) {
    setTierItems(prev => prev.map(i => i.id === id ? { ...i, note: note || undefined } : i))
  }

  function handleSave() {
    setIsPending(true)
    onSave(mode, rankItems, tierItems, [...tierRankedTiers]).finally(() => setIsPending(false))
  }
  function handleDelete() {
    if (onDelete) {
      setIsPending(true)
      onDelete().finally(() => setIsPending(false))
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>
          {hasExisting ? t.editListTitle : t.createListTitle}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {(['RANKED', 'TIER'] as const).map((m, i) => (
            <button key={m} onClick={() => { setMode(m); setIsImporting(false); setImportResult(null); setImportText('') }} style={{
              padding: '5px 13px', border: 'none',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              background: mode === m ? 'var(--accent-faint)' : 'none',
              color: mode === m ? 'var(--accent-fg)' : 'var(--fg-7)',
              fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {m === 'RANKED' ? t.typeRanked : t.typeTier}
            </button>
          ))}
        </div>
        {currentListEmpty && !isImporting && (
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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-4)' }}>
              {mode === 'RANKED' ? 'Importer une liste classée' : 'Importer une tier list'}
            </span>
            <button onClick={() => { setIsImporting(false); setImportText(''); setImportResult(null) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--fg-7)', lineHeight: 1 }}>×</button>
          </div>

          {!importResult ? (
            <>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-6)', lineHeight: 1.6 }}>
                {mode === 'RANKED'
                  ? <>Liste numérotée — <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>1. Titre</code>, un par ligne.</>
                  : <>
                    Écris le code du niveau sur sa propre ligne suivi de <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>:</code>, puis les titres en dessous.{' '}
                    Niveaux disponibles :{' '}
                    {TIERS.map((t, i) => (
                      <span key={t}>
                        <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>{t}</code>
                        {' '}({TIER_LABEL[t]}){i < TIERS.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </>
                }
              </p>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={mode === 'RANKED'
                  ? '1. Mon film préféré\n2. Deuxième film\n3. Troisième film'
                  : 'EX:\nFilm A\nFilm B\n\nTB:\nFilm C\nFilm D\n\nBO:\nFilm E'
                }
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

      {/* RANKED mode */}
      {mode === 'RANKED' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', marginBottom: 10 }}>{t.availableResources}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map(item => {
                const added = rankItems.some(i => i.id === item.id)
                return (
                  <button key={item.id} onClick={() => added ? removeRanked(item.id) : addRanked(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 8, border: `1px solid ${added ? 'var(--accent-muted)' : 'var(--border)'}`, background: added ? 'var(--accent-faint)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s' }}>
                    {item.prefix && <span style={{ fontSize: 18 }}>{item.prefix}</span>}
                    <span style={{ fontSize: 13, color: added ? 'var(--accent-fg)' : 'var(--fg-3)', flex: 1 }}>{item.label}</span>
                    {item.suffix && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.suffix}</span>}
                    <span style={{ fontSize: 14, color: added ? 'var(--accent-fg)' : 'var(--fg-8)' }}>{added ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', marginBottom: 10 }}>{t.myRanking} ({rankItems.length})</div>
            {rankItems.length === 0 ? (
              <p style={{ color: 'var(--fg-8)', fontSize: 13 }}>{t.clickToAdd}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {rankItems.map((rankItem, idx) => {
                  const item = getItem(rankItem.id)
                  if (!item) return null
                  const isDragging = dragId === rankItem.id
                  const isOver = dragOverId === rankItem.id
                  return (
                    <div key={rankItem.id}
                      draggable
                      onDragStart={() => setDragId(rankItem.id)}
                      onDragOver={ev => { ev.preventDefault(); if (!isDragging) setDragOverId(rankItem.id) }}
                      onDrop={() => { if (dragId && dragId !== rankItem.id) reorder(dragId, rankItem.id); setDragId(null); setDragOverId(null) }}
                      onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: isOver ? 'var(--accent-faint)' : 'var(--bg-card)', border: `1px solid ${isOver ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: expandedNote === rankItem.id ? '8px 8px 0 0' : 8, opacity: isDragging ? 0.35 : 1, cursor: 'grab', transition: 'background .1s, border-color .1s, opacity .1s' }}>
                        <span style={{ color: 'var(--fg-7)', fontSize: 13, userSelect: 'none', letterSpacing: 1, flexShrink: 0 }}>⠿</span>
                        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color: idx < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 22, textAlign: 'center' }}>{idx + 1}</span>
                        {item.prefix && <span style={{ fontSize: 18 }}>{item.prefix}</span>}
                        <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.label}</span>
                        {item.suffix && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.suffix}</span>}
                        <button onClick={() => setExpandedNote(expandedNote === rankItem.id ? null : rankItem.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: rankItem.note ? '#f5a623' : 'var(--fg-8)', padding: '0 2px' }}>✏️</button>
                        <button onClick={() => removeRanked(rankItem.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 16, padding: '0 2px' }}>×</button>
                      </div>
                      {expandedNote === rankItem.id && (
                        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '7px 13px' }}>
                          <input value={rankItem.note ?? ''} onChange={ev => updateRankNote(rankItem.id, ev.target.value)} placeholder={t.addNoteHint} autoFocus style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit' }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TIER mode */}
      {mode === 'TIER' && (
        <div>
          {TIERS.map(tier => {
            const inTier = tierItems.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
            const isRankedTier = tierRankedTiers.has(tier)
            const isDropTarget = dragOverTier === tier
            const tierOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce((sum, t) => sum + tierItems.filter(i => i.tier === t).length, 0)
            return (
              <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 80, minHeight: 44, borderRadius: 7, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 9.5, color: TIER_COLOR[tier], flexShrink: 0, textAlign: 'center', padding: '0 6px' }}>{TIER_LABEL[tier]}</div>
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
                  style={{ flex: 1, minHeight: 44, background: isDropTarget ? 'var(--accent-faint)' : 'var(--bg-card)', border: `1px dashed ${isDropTarget ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 7, padding: '6px 10px', transition: 'background .12s, border-color .12s' }}
                >
                  {inTier.length === 0 && <span style={{ color: 'var(--fg-9)', fontSize: 12, fontStyle: 'italic' }}>← glisser ici</span>}

                  {isRankedTier ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {inTier.map((rankItem, idx) => {
                        const item = getItem(rankItem.id)
                        if (!item) return null
                        const isDragging = tierDragId === rankItem.id
                        const isOver = dragOverItemId === rankItem.id
                        return (
                          <div key={rankItem.id}
                            draggable
                            onDragStart={ev => { ev.stopPropagation(); setTierDragId(rankItem.id) }}
                            onDragOver={ev => { ev.preventDefault(); ev.stopPropagation(); if (!isDragging) setDragOverItemId(rankItem.id) }}
                            onDragLeave={() => setDragOverItemId(prev => prev === rankItem.id ? null : prev)}
                            onDrop={ev => {
                              ev.preventDefault(); ev.stopPropagation()
                              if (tierDragId && tierDragId !== rankItem.id) {
                                const fromTier = tierItems.find(i => i.id === tierDragId)?.tier
                                if (fromTier === tier) reorderWithinTier(tier, tierDragId, rankItem.id)
                                else dropOnTier(tierDragId, tier)
                              }
                              setDragOverTier(null); setDragOverItemId(null); setTierDragId(null)
                            }}
                            onDragEnd={() => { setTierDragId(null); setDragOverTier(null); setDragOverItemId(null) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 5, background: isOver ? 'var(--accent-faint)' : 'transparent', opacity: isDragging ? 0.35 : 1, cursor: 'grab', transition: 'background .1s' }}
                          >
                            <span style={{ color: 'var(--fg-7)', fontSize: 11, userSelect: 'none', flexShrink: 0 }}>⠿</span>
                            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 14, color: (tierOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 20, textAlign: 'center', flexShrink: 0 }}>{tierOffset + idx + 1}</span>
                            {item.prefix && <span style={{ fontSize: 16 }}>{item.prefix}</span>}
                            <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.label}</span>
                            {item.suffix && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.suffix}</span>}
                            <button onClick={() => setExpandedNote(expandedNote === rankItem.id ? null : rankItem.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: rankItem.note ? '#f5a623' : 'var(--fg-8)', padding: '0 2px', flexShrink: 0 }}>✏️</button>
                            <button onClick={() => setTierItems(prev => { const r = prev.filter(i => i.id !== rankItem.id); let pos = 1; return r.map(i => i.tier === tier ? { ...i, position: pos++ } : i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>×</button>
                          </div>
                        )
                      })}
                      {expandedNote && tierItems.find(i => i.id === expandedNote && i.tier === tier) && (
                        <div style={{ paddingLeft: 26 }}>
                          <input value={tierItems.find(i => i.id === expandedNote)?.note ?? ''} onChange={ev => updateTierNote(expandedNote, ev.target.value)} placeholder={t.addNoteHint} autoFocus style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', outline: 'none', color: 'var(--fg-2)', fontSize: 11, fontFamily: 'inherit', borderRadius: 4, padding: '3px 8px', width: '100%' }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {inTier.map(rankItem => {
                        const item = getItem(rankItem.id)
                        if (!item) return null
                        return (
                          <div key={rankItem.id}
                            draggable
                            onDragStart={ev => { ev.stopPropagation(); setTierDragId(rankItem.id) }}
                            onDragEnd={() => { setTierDragId(null); setDragOverTier(null) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-subtle)', borderRadius: 5, padding: '3px 9px', cursor: 'grab', opacity: tierDragId === rankItem.id ? 0.35 : 1 }}
                          >
                            {item.prefix && <span style={{ fontSize: 14 }}>{item.prefix}</span>}
                            <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{item.label}</span>
                            <button onClick={() => setTierItems(prev => prev.filter(i => i.id !== rankItem.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
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

          {/* Unclassified */}
          <div
            style={{ marginTop: 14 }}
            onDragOver={ev => ev.preventDefault()}
            onDrop={() => { if (tierDragId) dropOnUnclassified(tierDragId); setTierDragId(null); setDragOverTier(null) }}
          >
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-8)', marginBottom: 8 }}>
              {t.noTier}
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-9)', textTransform: 'none', letterSpacing: 0 }}>— glisser vers un tier</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.filter(item => !tierItems.some(i => i.id === item.id)).map(item => (
                <div key={item.id}
                  draggable
                  onDragStart={() => setTierDragId(item.id)}
                  onDragEnd={() => { setTierDragId(null); setDragOverTier(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: 'grab', opacity: tierDragId === item.id ? 0.4 : 1, userSelect: 'none', transition: 'opacity .1s' }}
                >
                  <span style={{ fontSize: 11, color: 'var(--fg-7)', lineHeight: 1 }}>⠿</span>
                  {item.prefix && <span style={{ fontSize: 16 }}>{item.prefix}</span>}
                  <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{item.label}</span>
                  {item.suffix && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.suffix}</span>}
                </div>
              ))}
              {items.every(item => tierItems.some(i => i.id === item.id)) && (
                <span style={{ color: 'var(--fg-8)', fontSize: 12 }}>{t.allClassified}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {onDelete && hasExisting && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={handleDelete} disabled={isPending} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #f57c7c44', background: 'none', color: '#f57c7c', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
            {t.deleteList}
          </button>
        </div>
      )}
    </div>
  )
}
