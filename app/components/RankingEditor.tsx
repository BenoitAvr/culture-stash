'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/dictionaries/client'

export type RankableItem = {
  id: string
  label: string
  prefix?: string
  suffix?: string
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

  const [isImporting, setIsImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<{ matched: RankEditItem[]; unmatched: string[] } | null>(null)
  const [search, setSearch] = useState('')
  const [quickAddId, setQuickAddId] = useState<string | null>(null)
  const [quickAddTier, setQuickAddTier] = useState<string | null>(null)
  const [unclassifiedLimit, setUnclassifiedLimit] = useState(100)
  const [showAddForm, setShowAddForm] = useState(false)
  const wasPendingRef = useRef(false)
  useEffect(() => {
    if (wasPendingRef.current && !addPending && !addError) setShowAddForm(false)
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
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 80, minHeight: 44, borderRadius: 7, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 9.5, color: TIER_COLOR[tier], flexShrink: 0, textAlign: 'center', padding: '0 6px' }}>
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
                style={{ flex: 1, minHeight: 44, background: isDropTarget ? 'var(--accent-faint)' : 'var(--bg-card)', border: `1px dashed ${isDropTarget ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 7, padding: '6px 10px', transition: 'background .12s, border-color .12s' }}
              >
                {inTier.length === 0 && <span style={{ color: 'var(--fg-6)', fontSize: 12, fontStyle: 'italic' }}>← glisser ici</span>}
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
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 14, color: (tierOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-5)', minWidth: 20, textAlign: 'center', flexShrink: 0 }}>{tierOffset + idx + 1}</span>
                          {item.prefix && <span style={{ fontSize: 16 }}>{item.prefix}</span>}
                          <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.label}</span>
                          {item.suffix && <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>{item.suffix}</span>}
                          <button onClick={() => setTierItems(prev => { const r = prev.filter(i => i.id !== rankItem.id); let pos = 1; return r.map(i => i.tier === tier ? { ...i, position: pos++ } : i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>×</button>
                        </div>
                      )
                    })}
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

        {/* Non classés */}
        <div
          style={{ marginTop: 14 }}
          onDragOver={ev => ev.preventDefault()}
          onDrop={() => { if (tierDragId) dropOnUnclassified(tierDragId); setTierDragId(null); setDragOverTier(null) }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-5)', whiteSpace: 'nowrap' }}>
              {t.noTier}
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>— glisser vers un tier</span>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ flex: 1, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 12, fontFamily: 'inherit', outline: 'none', minWidth: 0 }}
            />
            {addFormAction && (
              <button
                onClick={() => setShowAddForm(v => !v)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: showAddForm ? 'var(--bg-subtle)' : 'none', color: 'var(--fg-5)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {showAddForm ? '× Annuler' : `+ ${addEntryLabel ?? 'Ajouter'}`}
              </button>
            )}
          </div>
          {addFormAction && showAddForm && (
            <div style={{ marginBottom: 12 }}>
              {addError && (
                <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, color: 'var(--error-text)', fontSize: 13 }}>{addError}</div>
              )}
              <form action={addFormAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 160px' }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--fg-6)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Titre</label>
                  <input name="title" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--fg)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div style={{ flex: '0 1 80px' }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--fg-6)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Année</label>
                  <input name="year" type="number" min={1888} max={2099} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--fg)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <button type="submit" disabled={addPending} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontWeight: 600, cursor: addPending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: addPending ? 0.7 : 1, flexShrink: 0 }}>
                  {addPending ? '…' : 'Ajouter'}
                </button>
              </form>
            </div>
          )}
          {(() => {
            const unclassified = items.filter(item => !tierItems.some(i => i.id === item.id) && (!search.trim() || normalizeTitle(item.label).includes(normalizeTitle(search))))
            const visibleUnclassified = search.trim() ? unclassified : unclassified.slice(0, unclassifiedLimit)
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {visibleUnclassified.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div
                      draggable
                      onDragStart={() => { setTierDragId(item.id); setQuickAddId(null) }}
                      onDragEnd={() => { setTierDragId(null); setDragOverTier(null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: `1px solid ${quickAddId === item.id ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 7, padding: '5px 8px 5px 12px', cursor: 'grab', opacity: tierDragId === item.id ? 0.4 : 1, userSelect: 'none', transition: 'opacity .1s, border-color .1s' }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--fg-7)', lineHeight: 1 }}>⠿</span>
                      {item.prefix && <span style={{ fontSize: 16 }}>{item.prefix}</span>}
                      <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{item.label}</span>
                      {item.suffix && <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>{item.suffix}</span>}
                      <button
                        onClick={() => {
                          setQuickAddId(prev => prev === item.id ? null : item.id)
                          setQuickAddTier(null)
                        }}
                        style={{ marginLeft: 2, background: quickAddId === item.id ? 'var(--accent-faint)' : 'none', border: 'none', cursor: 'pointer', color: quickAddId === item.id ? 'var(--accent-fg)' : 'var(--fg-7)', fontSize: 14, lineHeight: 1, padding: '0 2px', borderRadius: 3, flexShrink: 0 }}
                      >+</button>
                    </div>
                    {quickAddId === item.id && quickAddTier === null && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 4 }}>
                        {TIERS.map(tier => {
                          const isRanked = tierRankedTiers.has(tier)
                          const hasItems = tierItems.some(i => i.tier === tier && i.id !== item.id)
                          return (
                            <button
                              key={tier}
                              onClick={() => {
                                if (isRanked && hasItems) {
                                  setQuickAddTier(tier)
                                } else {
                                  dropOnTier(item.id, tier)
                                  setQuickAddId(null)
                                  setQuickAddTier(null)
                                }
                              }}
                              style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${TIER_COLOR[tier]}55`, background: `${TIER_COLOR[tier]}18`, color: TIER_COLOR[tier], fontSize: 10, fontFamily: "'Fraunces', serif", fontWeight: 700, cursor: 'pointer' }}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4, marginTop: 2 }}>
                          <div style={{ fontSize: 10, color: 'var(--fg-6)', marginBottom: 2 }}>
                            Position dans <span style={{ color: tierColor, fontWeight: 600 }}>{TIER_LABEL[tier]}</span> :
                          </div>
                          <button
                            onClick={() => {
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
                                onClick={() => {
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
                            onClick={() => setQuickAddTier(null)}
                            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 10, fontFamily: 'inherit', marginTop: 2 }}
                          >
                            ← Changer de tier
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                ))}
                {unclassified.length === 0 && (
                  search.trim() && addFormAction ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>"{search}" n'est pas encore dans la liste.</span>
                      <button
                        onClick={() => setShowAddForm(true)}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--accent-fg)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        + Ajouter
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--fg-5)', fontSize: 12 }}>{search.trim() ? 'Aucun résultat' : t.allClassified}</span>
                  )
                )}
                {!search.trim() && unclassified.length > unclassifiedLimit && (
                  <div style={{ width: '100%', marginTop: 8 }}>
                    <button
                      onClick={() => setUnclassifiedLimit(c => c + 100)}
                      style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-5)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Voir plus ({unclassified.length - unclassifiedLimit} restants)
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

    </div>
  )
}
