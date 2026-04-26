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
  type: 'RANKED' | 'TIER'
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
  const [editType, setEditType] = useState<'RANKED' | 'TIER' | null>(null)
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState<'RANKED' | 'TIER' | null>(null)

  const myRankedList = userEntryLists.find(l => l.userId === currentUserId && l.type === 'RANKED') ?? null
  const myTierList = userEntryLists.find(l => l.userId === currentUserId && l.type === 'TIER') ?? null
  const otherLists = userEntryLists.filter(l => l.userId !== currentUserId)

  function startEdit(type: 'RANKED' | 'TIER') {
    const existing = type === 'RANKED' ? myRankedList : myTierList
    if (existing) {
      setEditItems(
        type === 'RANKED'
          ? [...existing.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map(i => ({ entryId: i.entryId, position: i.position ?? undefined, note: i.note ?? undefined }))
          : existing.items.map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, note: i.note ?? undefined }))
      )
    } else {
      setEditItems([])
    }
    setExpandedNote(null)
    setEditType(type)
  }

  function handleSave(items = editItems) {
    if (!editType) return
    startTransition(async () => {
      await saveUserEntryList(topicSlug, editType, items)
      setEditType(null)
    })
  }

  function addRanked(entryId: string) {
    if (editItems.some(i => i.entryId === entryId)) return
    setEditItems(prev => [...prev, { entryId, position: prev.length + 1 }])
  }

  function removeRanked(entryId: string) {
    setEditItems(prev =>
      prev.filter(i => i.entryId !== entryId).map((item, idx) => ({ ...item, position: idx + 1 }))
    )
  }

  function move(entryId: string, dir: -1 | 1) {
    setEditItems(prev => {
      const idx = prev.findIndex(i => i.entryId === entryId)
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr.map((item, i) => ({ ...item, position: i + 1 }))
    })
  }

  function assignTier(entryId: string, tier: string) {
    const existing = editItems.find(i => i.entryId === entryId)
    if (existing?.tier === tier) {
      setEditItems(prev => prev.filter(i => i.entryId !== entryId))
    } else if (existing) {
      setEditItems(prev => prev.map(i => i.entryId === entryId ? { ...i, tier } : i))
    } else {
      setEditItems(prev => [...prev, { entryId, tier }])
    }
  }

  function updateNote(entryId: string, note: string) {
    setEditItems(prev => prev.map(i => i.entryId === entryId ? { ...i, note: note || undefined } : i))
  }

  const getEntry = (id: string) => entries.find(e => e.id === id)

  function buildMarkdownText(list: UserEntryListData) {
    const lines: string[] = []
    if (list.type === 'RANKED') {
      lines.push(`# ${topicTitle} — Mon classement\n`)
      ;[...list.items]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach((item, idx) => {
          const year = item.entry.year ? ` (${item.entry.year})` : ''
          lines.push(`${idx + 1}. ${item.entry.title}${year}`)
          if (item.note) lines.push(`   > ${item.note}`)
        })
    } else {
      lines.push(`# ${topicTitle} — Ma tier list\n`)
      TIERS.filter(tier => list.items.some(i => i.tier === tier)).forEach(tier => {
        const tierItems = list.items.filter(i => i.tier === tier)
        lines.push(`**${tier}** — ${tierItems.map(i => i.entry.title).join(', ')}`)
      })
    }
    return lines.join('\n')
  }

  function copyMarkdown(type: 'RANKED' | 'TIER') {
    const list = type === 'RANKED' ? myRankedList : myTierList
    if (!list) return
    navigator.clipboard.writeText(buildMarkdownText(list)).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const card = (children: React.ReactNode) => (
    <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 18, marginBottom: 14 }}>
      {children}
    </div>
  )

  if (editType !== null) {
    const selected = editItems.map(i => i.entryId)
    const existingList = editType === 'RANKED' ? myRankedList : myTierList
    return (
      <div style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#777', margin: 0 }}>
            {existingList
              ? (editType === 'RANKED' ? t.editListTitle : 'Modifier ma tier list')
              : (editType === 'RANKED' ? t.createListTitle : 'Créer ma tier list')}
          </h3>
          <div style={{ flex: 1, height: 1, background: '#2a2a2a' }} />
        </div>

        {editType === 'RANKED' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: '#555', marginBottom: 10 }}>{t.availableResources}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.map(e => {
                  const added = selected.includes(e.id)
                  return (
                    <button key={e.id} onClick={() => added ? removeRanked(e.id) : addRanked(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${added ? '#c8f55a44' : '#2a2a2a'}`, background: added ? '#c8f55a11' : '#111', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 13, color: added ? '#c8f55a' : '#ccc', flex: 1 }}>{e.title}</span>
                      {e.year && <span style={{ fontSize: 11, color: '#444' }}>{e.year}</span>}
                      <span style={{ fontSize: 18, color: added ? '#c8f55a' : '#444' }}>{added ? '✓' : '+'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: '#555', marginBottom: 10 }}>{t.myRanking} ({editItems.length})</div>
              {editItems.length === 0 ? (
                <p style={{ color: '#555', fontSize: 13 }}>{t.clickToAdd}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editItems.map((item, idx) => {
                    const e = getEntry(item.entryId)
                    if (!e) return null
                    return (
                      <div key={item.entryId}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: expandedNote === item.entryId ? '8px 8px 0 0' : 8 }}>
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 18, color: idx < 3 ? '#c8f55a' : '#555', minWidth: 24, textAlign: 'center' }}>{idx + 1}</span>
                          <span style={{ fontSize: 13, color: '#ccc', flex: 1 }}>{e.title}</span>
                          {e.year && <span style={{ fontSize: 11, color: '#444' }}>{e.year}</span>}
                          <button onClick={() => setExpandedNote(expandedNote === item.entryId ? null : item.entryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: item.note ? '#f5a623' : '#555', padding: '0 2px' }}>✏️</button>
                          <button onClick={() => move(item.entryId, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#333' : '#777', fontSize: 14, padding: '0 2px' }}>▲</button>
                          <button onClick={() => move(item.entryId, 1)} disabled={idx === editItems.length - 1} style={{ background: 'none', border: 'none', cursor: idx === editItems.length - 1 ? 'default' : 'pointer', color: idx === editItems.length - 1 ? '#333' : '#777', fontSize: 14, padding: '0 2px' }}>▼</button>
                          <button onClick={() => removeRanked(item.entryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16, padding: '0 2px' }}>×</button>
                        </div>
                        {expandedNote === item.entryId && (
                          <div style={{ background: '#0e0e0e', border: '1px solid #2a2a2a', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 14px' }}>
                            <input value={item.note ?? ''} onChange={e => updateNote(item.entryId, e.target.value)} placeholder={t.addNoteHint} style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: '#ccc', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
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

        {editType === 'TIER' && (
          <div>
            {TIERS.map(tier => {
              const tierItems = editItems.filter(i => i.tier === tier)
              return (
                <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 18, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</div>
                  <div style={{ flex: 1, minHeight: 40, background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {tierItems.map(item => {
                      const e = getEntry(item.entryId)
                      if (!e) return null
                      return (
                        <div key={item.entryId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e1e1e', borderRadius: 6, padding: '4px 10px' }}>
                            <span style={{ fontSize: 12, color: '#ccc' }}>{e.title}</span>
                            <button onClick={() => setExpandedNote(expandedNote === item.entryId ? null : item.entryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: item.note ? '#f5a623' : '#444', padding: 0 }}>✏️</button>
                            <button onClick={() => assignTier(item.entryId, tier)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </div>
                          {expandedNote === item.entryId && (
                            <input value={item.note ?? ''} onChange={ev => updateNote(item.entryId, ev.target.value)} placeholder={t.addNoteHint} style={{ background: '#1e1e1e', border: 'none', outline: 'none', color: '#ccc', fontSize: 11, fontFamily: 'inherit', borderRadius: 4, padding: '3px 8px', width: 140 }} />
                          )}
                        </div>
                      )
                    })}
                    {tierItems.length === 0 && <span style={{ color: '#333', fontSize: 12 }}>—</span>}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: '#444', marginBottom: 8 }}>{t.noTier}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {entries.filter(e => !editItems.some(i => i.entryId === e.id)).map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12, color: '#aaa' }}>{e.title}</span>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                      {TIERS.map(tier => (
                        <button key={tier} onClick={() => assignTier(e.id, tier)} style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${TIER_COLOR[tier]}44`, background: `${TIER_COLOR[tier]}11`, color: TIER_COLOR[tier], fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tier}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {entries.every(e => editItems.some(i => i.entryId === e.id)) && (
                  <span style={{ color: '#444', fontSize: 12 }}>{t.allClassified}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={() => handleSave()} disabled={isPending} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#c8f55a', color: '#0e0e0e', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t.saving : t.save}
          </button>
          <button onClick={() => setEditType(null)} disabled={isPending} style={{ padding: '9px 22px', borderRadius: 8, border: '1px solid #2a2a2a', background: 'none', color: '#777', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            {t.cancel}
          </button>
          {existingList && (
            <button onClick={() => { setEditItems([]); handleSave([]) }} disabled={isPending} style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: 8, border: '1px solid #f57c7c44', background: 'none', color: '#f57c7c', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              {t.deleteList}
            </button>
          )}
        </div>
      </div>
    )
  }

  const myLists = [...(myRankedList ? [myRankedList] : []), ...(myTierList ? [myTierList] : [])]
  const allLists = [...myLists, ...otherLists]

  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOpen ? 20 : 0 }}>
        <button onClick={() => setIsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#777' }}>{t.personalRankings}</span>
          <span style={{ fontSize: 10, color: '#555', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          {allLists.length > 0 && <span style={{ fontSize: 11, color: '#555' }}>({allLists.length})</span>}
        </button>
        <div style={{ flex: 1, height: 1, background: '#2a2a2a' }} />
        {isLoggedIn && isOpen && (
          <div style={{ display: 'flex', gap: 8 }}>
            {myRankedList && (
              <button onClick={() => copyMarkdown('RANKED')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2a2a2a', background: 'none', color: copied === 'RANKED' ? '#c8f55a' : '#555', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', transition: 'color .2s' }}>
                {copied === 'RANKED' ? '✓ Copié' : '⎘ Copier classement'}
              </button>
            )}
            {myTierList && (
              <button onClick={() => copyMarkdown('TIER')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2a2a2a', background: 'none', color: copied === 'TIER' ? '#c8f55a' : '#555', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', transition: 'color .2s' }}>
                {copied === 'TIER' ? '✓ Copié' : '⎘ Copier tier list'}
              </button>
            )}
            <button onClick={() => startEdit('RANKED')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px dashed #444', background: 'none', color: '#777', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
              {myRankedList ? 'Modifier classement' : 'Créer classement'}
            </button>
            <button onClick={() => startEdit('TIER')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px dashed #444', background: 'none', color: '#777', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
              {myTierList ? 'Modifier tier list' : 'Créer tier list'}
            </button>
          </div>
        )}
      </div>

      {isOpen && (allLists.length === 0 ? (
        <p style={{ color: '#555', fontSize: 13 }}>{isLoggedIn ? t.beFirst : t.noPersRankings}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {allLists.map(list => {
            const ac = AVATAR_COLORS[list.userName.charCodeAt(0) % 4]
            const isMe = list.userId === currentUserId
            return card(
              <div key={list.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: `${ac}22`, color: ac, fontFamily: "'Fraunces', serif", flexShrink: 0 }}>
                    {list.userName[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, color: '#f0f0f0', fontWeight: 500, flex: 1 }}>{list.userName}</span>
                  {isMe && <span style={{ fontSize: 11, color: '#777' }}>{t.me}</span>}
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#1e1e1e', color: '#777', border: '1px solid #2a2a2a' }}>
                    {list.type === 'RANKED' ? t.ranked : t.tier}
                  </span>
                </div>

                {list.type === 'RANKED' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...list.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((item, idx) => (
                      <div key={item.entryId}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color: idx < 3 ? '#c8f55a' : '#555', minWidth: 22, textAlign: 'center' }}>{idx + 1}</span>
                          <span style={{ fontSize: 13, color: '#ccc' }}>{item.entry.title}</span>
                          {item.entry.year && <span style={{ fontSize: 11, color: '#444' }}>{item.entry.year}</span>}
                        </div>
                        {item.note && <p style={{ margin: '3px 0 3px 32px', fontSize: 12, color: '#777', fontStyle: 'italic' }}>{item.note}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {list.type === 'TIER' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {TIERS.filter(tier => list.items.some(i => i.tier === tier)).map(tier => (
                      <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 14, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                          {list.items.filter(i => i.tier === tier).map(item => (
                            <div key={item.entryId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1e1e1e', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#ccc' }}>
                                <span>{item.entry.title}</span>
                              </div>
                              {item.note && <p style={{ margin: '2px 0 0 4px', fontSize: 11, color: '#777', fontStyle: 'italic' }}>{item.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
