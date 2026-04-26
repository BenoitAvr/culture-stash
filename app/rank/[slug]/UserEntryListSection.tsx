'use client'

import { useState, useTransition } from 'react'
import { saveUserEntryList } from '@/app/actions/entryLists'
import type { Dict } from '@/dictionaries/client'

type EntryItem = { id: string; title: string; year: number | null }

type ListItemData = {
  entryId: string
  position: number | null
  tier: string | null
  note: string | null
  entry: EntryItem
}

export type UserEntryListData = {
  id: string
  userId: string
  userName: string
  type: 'RANKED' | 'TIER' | 'BOTH'
  rankedTiers: string | null
  items: ListItemData[]
}

type EditItem = { entryId: string; position?: number; tier?: string; note?: string }

const TIERS = ['S', 'A', 'B', 'C', 'D']
const TIER_COLOR: Record<string, string> = {
  S: '#f5a623', A: '#7c6df0', B: '#c8f55a', C: '#f57c7c', D: '#777',
}
const AVATAR_COLORS = ['#7c6df0', '#f5a623', '#c8f55a', '#f57c7c']

export function UserEntryListSection({
  topicSlug, topicTitle, entries, userEntryLists, currentUserId, isLoggedIn, t,
}: {
  topicSlug: string
  topicTitle: string
  entries: EntryItem[]
  userEntryLists: UserEntryListData[]
  currentUserId: string | null
  isLoggedIn: boolean
  t: Dict['rankings']
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [mode, setMode] = useState<'RANKED' | 'TIER'>('TIER')

  // Two completely independent states — switching mode never modifies either
  const [rankItems, setRankItems] = useState<EditItem[]>([])
  const [tierItems, setTierItems] = useState<EditItem[]>([])
  const [tierRankedTiers, setTierRankedTiers] = useState(new Set<string>())

  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  // drag state for RANKED mode
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // drag state for TIER mode
  const [tierDragId, setTierDragId] = useState<string | null>(null)
  const [dragOverTier, setDragOverTier] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)

  const myRankedList = userEntryLists.find(l => l.userId === currentUserId && l.type === 'RANKED') ?? null
  const myTierList = userEntryLists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  // Pour la vue : grouper par userId (un user peut avoir deux listes)
  const userIds = [...new Set(userEntryLists.map(l => l.userId))]
  // currentUser en premier
  const sortedUserIds = [
    ...userIds.filter(id => id === currentUserId),
    ...userIds.filter(id => id !== currentUserId),
  ]

  function startEdit() {
    setMode(myTierList ? 'TIER' : 'RANKED')
    setTierRankedTiers(new Set((myTierList?.rankedTiers ?? '').split(',').filter(Boolean)))

    setRankItems(myRankedList
      ? [...myRankedList.items]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map(i => ({ entryId: i.entryId, position: i.position ?? undefined, note: i.note ?? undefined }))
      : [])

    setTierItems(myTierList
      ? myTierList.items.map(i => ({
          entryId: i.entryId,
          position: i.position ?? undefined,
          tier: i.tier ?? undefined,
          note: i.note ?? undefined,
        }))
      : [])

    setExpandedNote(null)
    setIsEditing(true)
  }

  function handleSave() {
    // Sauvegarder les deux listes indépendamment — zéro interaction entre elles
    startTransition(async () => {
      await saveUserEntryList(topicSlug, 'RANKED', rankItems)
      await saveUserEntryList(topicSlug, 'TIER', tierItems, [...tierRankedTiers])
      setIsEditing(false)
    })
  }

  // ── RANKED helpers ──

  function addRanked(entryId: string) {
    if (rankItems.some(i => i.entryId === entryId)) return
    setRankItems(prev => [...prev, { entryId, position: prev.length + 1 }])
  }

  function removeRanked(entryId: string) {
    setRankItems(prev =>
      prev.filter(i => i.entryId !== entryId).map((item, idx) => ({ ...item, position: idx + 1 }))
    )
  }

  function reorder(fromId: string, toId: string) {
    setRankItems(prev => {
      const items = [...prev]
      const fromIdx = items.findIndex(i => i.entryId === fromId)
      const toIdx = items.findIndex(i => i.entryId === toId)
      const [moved] = items.splice(fromIdx, 1)
      items.splice(toIdx, 0, moved)
      return items.map((item, i) => ({ ...item, position: i + 1 }))
    })
  }

  function updateRankNote(entryId: string, note: string) {
    setRankItems(prev => prev.map(i => i.entryId === entryId ? { ...i, note: note || undefined } : i))
  }

  // ── TIER helpers ──

  function dropOnTier(entryId: string, tier: string) {
    setTierItems(prev => {
      const existing = prev.find(i => i.entryId === entryId)
      const oldTier = existing?.tier
      if (oldTier === tier) return prev

      const tierCount = prev.filter(i => i.tier === tier && i.entryId !== entryId).length
      const position = tierRankedTiers.has(tier) ? tierCount + 1 : undefined

      let updated: EditItem[] = existing
        ? prev.map(i => i.entryId === entryId ? { ...i, tier, position } : i)
        : [...prev, { entryId, tier, position }]

      if (oldTier && tierRankedTiers.has(oldTier)) {
        let pos = 1
        updated = updated.map(i => i.tier === oldTier ? { ...i, position: pos++ } : i)
      }
      return updated
    })
  }

  function dropOnUnclassified(entryId: string) {
    setTierItems(prev => {
      const item = prev.find(i => i.entryId === entryId)
      const oldTier = item?.tier
      if (!item || !oldTier) return prev
      const removed = prev.filter(i => i.entryId !== entryId)
      if (tierRankedTiers.has(oldTier)) {
        let pos = 1
        return removed.map(i => i.tier === oldTier ? { ...i, position: pos++ } : i)
      }
      return removed
    })
  }

  function reorderWithinTier(tier: string, fromId: string, toId: string) {
    setTierItems(prev => {
      const inTier = prev
        .filter(i => i.tier === tier)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const other = prev.filter(i => i.tier !== tier)
      const fromIdx = inTier.findIndex(i => i.entryId === fromId)
      const toIdx = inTier.findIndex(i => i.entryId === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = inTier.splice(fromIdx, 1)
      inTier.splice(toIdx, 0, moved)
      return [...other, ...inTier.map((item, i) => ({ ...item, position: i + 1 }))]
    })
  }

  function toggleTierRanking(tier: string) {
    const willBeRanked = !tierRankedTiers.has(tier)
    setTierRankedTiers(prev => {
      const s = new Set(prev)
      if (willBeRanked) s.add(tier); else s.delete(tier)
      return s
    })
    if (willBeRanked) {
      setTierItems(prev => {
        let pos = 1
        return prev.map(i => i.tier === tier ? { ...i, position: pos++ } : i)
      })
    } else {
      setTierItems(prev => prev.map(i => i.tier === tier ? { ...i, position: undefined } : i))
    }
  }

  function updateTierNote(entryId: string, note: string) {
    setTierItems(prev => prev.map(i => i.entryId === entryId ? { ...i, note: note || undefined } : i))
  }

  const getEntry = (id: string) => entries.find(e => e.id === id)

  function buildMarkdown() {
    const lines: string[] = []
    if (myRankedList && mode === 'RANKED') {
      lines.push(`# ${topicTitle} — Mon classement\n`)
      ;[...myRankedList.items]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach((item, idx) => {
          lines.push(`${idx + 1}. ${item.entry.title}${item.entry.year ? ` (${item.entry.year})` : ''}`)
          if (item.note) lines.push(`   > ${item.note}`)
        })
    } else if (myTierList) {
      const rts = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
      lines.push(`# ${topicTitle} — Ma tier list\n`)
      TIERS.filter(tier => myTierList.items.some(i => i.tier === tier)).forEach(tier => {
        const tItems = myTierList.items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        if (rts.includes(tier)) {
          lines.push(`\n**${tier}** (classé)`)
          tItems.forEach((item, idx) => {
            lines.push(`${idx + 1}. ${item.entry.title}${item.entry.year ? ` (${item.entry.year})` : ''}`)
            if (item.note) lines.push(`   > ${item.note}`)
          })
        } else {
          lines.push(`**${tier}** — ${tItems.map(i => i.entry.title).join(', ')}`)
        }
      })
    }
    return lines.join('\n')
  }

  function copyMarkdown() {
    navigator.clipboard.writeText(buildMarkdown()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  /* ─────────────── Edit mode ─────────────── */
  if (isEditing) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>
            {(myRankedList || myTierList) ? 'Modifier ma liste' : 'Créer ma liste'}
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(['RANKED', 'TIER'] as const).map((m, i) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '5px 13px', border: 'none',
                borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                background: mode === m ? 'var(--accent-faint)' : 'none',
                color: mode === m ? 'var(--accent-fg)' : 'var(--fg-7)',
                fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {m === 'RANKED' ? '🏅 Classement' : '🎯 Tier list'}
              </button>
            ))}
          </div>
          <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-7)', fontFamily: 'inherit' }}>{t.cancel}</button>
          <button onClick={handleSave} disabled={isPending} style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t.saving : t.save}
          </button>
        </div>

        {/* ── RANKED mode ── */}
        {mode === 'RANKED' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', marginBottom: 10 }}>{t.availableResources}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {entries.map(e => {
                  const added = rankItems.some(i => i.entryId === e.id)
                  return (
                    <button key={e.id} onClick={() => added ? removeRanked(e.id) : addRanked(e.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 8, border: `1px solid ${added ? 'var(--accent-muted)' : 'var(--border)'}`, background: added ? 'var(--accent-faint)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s' }}>
                      <span style={{ fontSize: 13, color: added ? 'var(--accent-fg)' : 'var(--fg-3)', flex: 1 }}>{e.title}</span>
                      {e.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{e.year}</span>}
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
                  {rankItems.map((item, idx) => {
                    const e = getEntry(item.entryId)
                    if (!e) return null
                    const isDragging = dragId === item.entryId
                    const isOver = dragOverId === item.entryId
                    return (
                      <div key={item.entryId}
                        draggable
                        onDragStart={() => setDragId(item.entryId)}
                        onDragOver={ev => { ev.preventDefault(); if (!isDragging) setDragOverId(item.entryId) }}
                        onDrop={() => { if (dragId && dragId !== item.entryId) reorder(dragId, item.entryId); setDragId(null); setDragOverId(null) }}
                        onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: isOver ? 'var(--accent-faint)' : 'var(--bg-card)', border: `1px solid ${isOver ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: expandedNote === item.entryId ? '8px 8px 0 0' : 8, opacity: isDragging ? 0.35 : 1, cursor: 'grab', transition: 'background .1s, border-color .1s, opacity .1s' }}>
                          <span style={{ color: 'var(--fg-7)', fontSize: 13, userSelect: 'none', letterSpacing: 1, flexShrink: 0 }}>⠿</span>
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color: idx < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 22, textAlign: 'center' }}>{idx + 1}</span>
                          <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{e.title}</span>
                          {e.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{e.year}</span>}
                          <button onClick={() => setExpandedNote(expandedNote === item.entryId ? null : item.entryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: item.note ? '#f5a623' : 'var(--fg-8)', padding: '0 2px' }}>✏️</button>
                          <button onClick={() => removeRanked(item.entryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 16, padding: '0 2px' }}>×</button>
                        </div>
                        {expandedNote === item.entryId && (
                          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '7px 13px' }}>
                            <input value={item.note ?? ''} onChange={ev => updateRankNote(item.entryId, ev.target.value)} placeholder={t.addNoteHint} autoFocus style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit' }} />
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

        {/* ── TIER mode ── */}
        {mode === 'TIER' && (
          <div>
            {TIERS.map(tier => {
              const inTier = tierItems.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
              const isRankedTier = tierRankedTiers.has(tier)
              const isDropTarget = dragOverTier === tier
              const tierOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce((sum, t) => sum + tierItems.filter(i => i.tier === t).length, 0)

              return (
                <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  {/* Tier label */}
                  <div style={{ width: 38, minHeight: 44, borderRadius: 7, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 17, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</div>

                  {/* Drop zone */}
                  <div
                    onDragOver={ev => { ev.preventDefault(); setDragOverTier(tier) }}
                    onDragLeave={ev => {
                      if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setDragOverTier(null)
                    }}
                    onDrop={ev => {
                      ev.preventDefault()
                      if (tierDragId) {
                        const fromTier = tierItems.find(i => i.entryId === tierDragId)?.tier
                        if (fromTier !== tier) dropOnTier(tierDragId, tier)
                      }
                      setDragOverTier(null); setTierDragId(null)
                    }}
                    style={{ flex: 1, minHeight: 44, background: isDropTarget ? 'var(--accent-faint)' : 'var(--bg-card)', border: `1px dashed ${isDropTarget ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 7, padding: '6px 10px', transition: 'background .12s, border-color .12s' }}
                  >
                    {inTier.length === 0 && (
                      <span style={{ color: 'var(--fg-9)', fontSize: 12, fontStyle: 'italic' }}>← glisser ici</span>
                    )}

                    {isRankedTier ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {inTier.map((item, idx) => {
                          const e = getEntry(item.entryId)
                          if (!e) return null
                          const isDragging = tierDragId === item.entryId
                          const isOver = dragOverItemId === item.entryId
                          return (
                            <div key={item.entryId}
                              draggable
                              onDragStart={ev => { ev.stopPropagation(); setTierDragId(item.entryId) }}
                              onDragOver={ev => { ev.preventDefault(); ev.stopPropagation(); if (!isDragging) setDragOverItemId(item.entryId) }}
                              onDragLeave={() => setDragOverItemId(prev => prev === item.entryId ? null : prev)}
                              onDrop={ev => {
                                ev.preventDefault(); ev.stopPropagation()
                                if (tierDragId && tierDragId !== item.entryId) {
                                  const fromTier = tierItems.find(i => i.entryId === tierDragId)?.tier
                                  if (fromTier === tier) reorderWithinTier(tier, tierDragId, item.entryId)
                                  else dropOnTier(tierDragId, tier)
                                }
                                setDragOverTier(null); setDragOverItemId(null); setTierDragId(null)
                              }}
                              onDragEnd={() => { setTierDragId(null); setDragOverTier(null); setDragOverItemId(null) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 5, background: isOver ? 'var(--accent-faint)' : 'transparent', opacity: isDragging ? 0.35 : 1, cursor: 'grab', transition: 'background .1s' }}
                            >
                              <span style={{ color: 'var(--fg-7)', fontSize: 11, userSelect: 'none', flexShrink: 0 }}>⠿</span>
                              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 14, color: (tierOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 20, textAlign: 'center', flexShrink: 0 }}>{tierOffset + idx + 1}</span>
                              <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{e.title}</span>
                              {e.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{e.year}</span>}
                              <button onClick={() => setExpandedNote(expandedNote === item.entryId ? null : item.entryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: item.note ? '#f5a623' : 'var(--fg-8)', padding: '0 2px', flexShrink: 0 }}>✏️</button>
                              <button
                                onClick={() => {
                                  setTierItems(prev => {
                                    const removed = prev.filter(i => i.entryId !== item.entryId)
                                    let pos = 1
                                    return removed.map(i => i.tier === tier ? { ...i, position: pos++ } : i)
                                  })
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>×</button>
                            </div>
                          )
                        })}
                        {expandedNote && tierItems.find(i => i.entryId === expandedNote && i.tier === tier) && (
                          <div style={{ paddingLeft: 26 }}>
                            <input value={tierItems.find(i => i.entryId === expandedNote)?.note ?? ''} onChange={ev => updateTierNote(expandedNote, ev.target.value)} placeholder={t.addNoteHint} autoFocus style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', outline: 'none', color: 'var(--fg-2)', fontSize: 11, fontFamily: 'inherit', borderRadius: 4, padding: '3px 8px', width: '100%' }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {inTier.map(item => {
                          const e = getEntry(item.entryId)
                          if (!e) return null
                          return (
                            <div key={item.entryId}
                              draggable
                              onDragStart={ev => { ev.stopPropagation(); setTierDragId(item.entryId) }}
                              onDragEnd={() => { setTierDragId(null); setDragOverTier(null) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-subtle)', borderRadius: 5, padding: '3px 9px', cursor: 'grab', opacity: tierDragId === item.entryId ? 0.35 : 1 }}
                            >
                              <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{e.title}</span>
                              <button
                                onClick={() => setTierItems(prev => prev.filter(i => i.entryId !== item.entryId))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Per-tier ranking toggle */}
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
              onDrop={() => {
                if (tierDragId) dropOnUnclassified(tierDragId)
                setTierDragId(null); setDragOverTier(null)
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-8)', marginBottom: 8 }}>
                {t.noTier}
                <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-9)', textTransform: 'none', letterSpacing: 0 }}>— glisser vers un tier</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {entries.filter(e => !tierItems.some(i => i.entryId === e.id)).map(e => (
                  <div key={e.id}
                    draggable
                    onDragStart={() => setTierDragId(e.id)}
                    onDragEnd={() => { setTierDragId(null); setDragOverTier(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: 'grab', opacity: tierDragId === e.id ? 0.4 : 1, userSelect: 'none', transition: 'opacity .1s' }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--fg-7)', lineHeight: 1 }}>⠿</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{e.title}</span>
                    {e.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{e.year}</span>}
                  </div>
                ))}
                {entries.every(e => tierItems.some(i => i.entryId === e.id)) && (
                  <span style={{ color: 'var(--fg-8)', fontSize: 12 }}>{t.allClassified}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ─────────────── View mode ─────────────── */
  const hasBoth = sortedUserIds.some(uid => {
    const ranked = userEntryLists.find(l => l.userId === uid && l.type === 'RANKED')
    const tier = userEntryLists.find(l => l.userId === uid && (l.type === 'TIER' || l.type === 'BOTH'))
    return ranked && tier
  })

  function renderRankedItems(items: ListItemData[]) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[...items].filter(i => i.position !== null).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((item, idx) => (
          <div key={item.entryId}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 15, color: idx < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
              <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.entry.title}</span>
              {item.entry.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.entry.year}</span>}
            </div>
            {item.note && <p style={{ margin: '3px 0 3px 30px', fontSize: 12, color: 'var(--fg-6)', fontStyle: 'italic' }}>&ldquo;{item.note}&rdquo;</p>}
          </div>
        ))}
      </div>
    )
  }

  function renderTierItems(items: ListItemData[], rts: string[]) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TIERS.filter(tier => items.some(i => i.tier === tier)).map(tier => {
          const tItems = items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          const isRanked = rts.includes(tier)
          const viewOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce((sum, t) => sum + items.filter(i => i.tier === t).length, 0)
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 5, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 13, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</div>
              {isRanked ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tItems.map((item, idx) => (
                    <div key={item.entryId}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 13, color: (viewOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 16, textAlign: 'right' }}>{viewOffset + idx + 1}</span>
                        <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.entry.title}</span>
                        {item.entry.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.entry.year}</span>}
                      </div>
                      {item.note && <p style={{ margin: '2px 0 2px 24px', fontSize: 12, color: 'var(--fg-6)', fontStyle: 'italic' }}>&ldquo;{item.note}&rdquo;</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
                  {tItems.map(item => (
                    <div key={item.entryId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ background: 'var(--bg-subtle)', borderRadius: 5, padding: '2px 9px', fontSize: 12, color: 'var(--fg-2)' }}>{item.entry.title}</span>
                      {item.note && <p style={{ margin: '1px 0 0 4px', fontSize: 11, color: 'var(--fg-6)', fontStyle: 'italic' }}>&ldquo;{item.note}&rdquo;</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOpen ? 20 : 0 }}>
        <button onClick={() => setIsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: 0, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)' }}>{t.personalRankings}</span>
          <span style={{ fontSize: 9, color: 'var(--fg-7)', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          {sortedUserIds.length > 0 && <span style={{ fontSize: 11, color: 'var(--fg-8)', fontFamily: 'inherit' }}>({sortedUserIds.length})</span>}
        </button>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {isOpen && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {hasBoth && (
              <div style={{ display: 'flex', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {(['RANKED', 'TIER'] as const).map((m, i) => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: '4px 11px', border: 'none',
                    borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                    background: mode === m ? 'var(--accent-faint)' : 'none',
                    color: mode === m ? 'var(--accent-fg)' : 'var(--fg-7)',
                    fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {m === 'RANKED' ? '🏅' : '🎯'}
                  </button>
                ))}
              </div>
            )}
            {isLoggedIn && (
              <>
                {(myRankedList || myTierList) && (
                  <button onClick={copyMarkdown} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: copied ? 'var(--accent-fg)' : 'var(--fg-7)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {copied ? '✓ Copié' : '⎘ Copier'}
                  </button>
                )}
                <button onClick={startEdit} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: (myRankedList || myTierList) ? 'none' : 'var(--bg-card)', color: 'var(--fg-5)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {(myRankedList || myTierList) ? 'Modifier ma liste' : '+ Créer ma liste'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isOpen && (sortedUserIds.length === 0 ? (
        <p style={{ color: 'var(--fg-7)', fontSize: 13, padding: '20px 0' }}>{isLoggedIn ? t.beFirst : t.noPersRankings}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedUserIds.map(uid => {
            const rankedList = userEntryLists.find(l => l.userId === uid && l.type === 'RANKED') ?? null
            const tierList = userEntryLists.find(l => l.userId === uid && (l.type === 'TIER' || l.type === 'BOTH')) ?? null
            const anyList = rankedList ?? tierList!
            const ac = AVATAR_COLORS[anyList.userName.charCodeAt(0) % 4]
            const isMe = uid === currentUserId
            const rts = (tierList?.rankedTiers ?? '').split(',').filter(Boolean)
            const userHasBoth = rankedList !== null && tierList !== null
            const displayMode = userHasBoth ? mode : rankedList ? 'RANKED' : 'TIER'
            return (
              <div key={uid} style={{ background: 'var(--bg-card)', border: `1px solid ${isMe ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: `${ac}22`, color: ac, fontFamily: "'Fraunces', serif", flexShrink: 0 }}>
                    {anyList.userName[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--fg)', fontWeight: 500, flex: 1 }}>{anyList.userName}</span>
                  {isMe && <span style={{ fontSize: 11, color: 'var(--fg-7)', fontStyle: 'italic' }}>{t.me}</span>}
                </div>

                {displayMode === 'RANKED' && rankedList && renderRankedItems(rankedList.items)}
                {displayMode === 'TIER' && tierList && renderTierItems(tierList.items, rts)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
