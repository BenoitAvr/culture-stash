'use client'

import { useState, useTransition } from 'react'
import { saveUserList } from '@/app/actions/lists'
import type { Dict } from '@/dictionaries/client'

type Resource = { id: string; title: string; emoji: string; type: string }

type ListItemData = {
  resourceId: string
  position: number | null
  tier: string | null
  note: string | null
  resource: { id: string; title: string; emoji: string; type: string }
}

export type UserListData = {
  id: string
  userId: string
  userName: string
  type: 'RANKED' | 'TIER'
  items: ListItemData[]
}

type EditItem = { resourceId: string; position?: number; tier?: string; note?: string }

const TIERS = ['S', 'A', 'B', 'C', 'D']
const TIER_COLOR: Record<string, string> = {
  S: '#f5a623', A: '#7c6df0', B: '#c8f55a', C: '#f57c7c', D: '#777',
}
const AVATAR_COLORS = ['#7c6df0', '#f5a623', '#c8f55a', '#f57c7c']

export function UserListsSection({
  topicSlug, resources, userLists, currentUserId, isLoggedIn, t,
}: {
  topicSlug: string
  resources: Resource[]
  userLists: UserListData[]
  currentUserId: string | null
  isLoggedIn: boolean
  t: Dict['rankings']
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editType, setEditType] = useState<'RANKED' | 'TIER'>('RANKED')
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const myList = userLists.find(l => l.userId === currentUserId) ?? null
  const otherLists = userLists.filter(l => l.userId !== currentUserId)

  function startEdit() {
    if (myList) {
      setEditType(myList.type)
      setEditItems(
        myList.type === 'RANKED'
          ? [...myList.items]
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map(i => ({ resourceId: i.resourceId, position: i.position ?? undefined, note: i.note ?? undefined }))
          : myList.items.map(i => ({ resourceId: i.resourceId, tier: i.tier ?? undefined, note: i.note ?? undefined }))
      )
    } else {
      setEditType('RANKED')
      setEditItems([])
    }
    setExpandedNote(null)
    setMode('edit')
  }

  function handleSave() {
    startTransition(async () => {
      await saveUserList(topicSlug, editType, editItems)
      setMode('view')
    })
  }

  function addRanked(resourceId: string) {
    if (editItems.some(i => i.resourceId === resourceId)) return
    setEditItems(prev => [...prev, { resourceId, position: prev.length + 1 }])
  }

  function removeRanked(resourceId: string) {
    setEditItems(prev =>
      prev.filter(i => i.resourceId !== resourceId)
        .map((item, idx) => ({ ...item, position: idx + 1 }))
    )
  }

  function move(resourceId: string, dir: -1 | 1) {
    setEditItems(prev => {
      const idx = prev.findIndex(i => i.resourceId === resourceId)
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr.map((item, i) => ({ ...item, position: i + 1 }))
    })
  }

  function assignTier(resourceId: string, tier: string) {
    const existing = editItems.find(i => i.resourceId === resourceId)
    if (existing?.tier === tier) {
      setEditItems(prev => prev.filter(i => i.resourceId !== resourceId))
    } else if (existing) {
      setEditItems(prev => prev.map(i => i.resourceId === resourceId ? { ...i, tier } : i))
    } else {
      setEditItems(prev => [...prev, { resourceId, tier }])
    }
  }

  function updateNote(resourceId: string, note: string) {
    setEditItems(prev => prev.map(i => i.resourceId === resourceId ? { ...i, note: note || undefined } : i))
  }

  const getRes = (id: string) => resources.find(r => r.id === id)

  const card = (children: React.ReactNode, highlight = false) => (
    <div style={{ background: 'var(--bg-card)', border: `1px solid ${highlight ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 12, boxShadow: 'var(--shadow)', padding: 18, marginBottom: 14 }}>
      {children}
    </div>
  )

  if (mode === 'edit') {
    const rankedSelected = editItems.map(i => i.resourceId)

    return (
      <div style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', margin: 0 }}>
            {myList ? t.editListTitle : t.createListTitle}
          </h3>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['RANKED', 'TIER'] as const).map(tp => (
            <button key={tp} onClick={() => { setEditType(tp); setEditItems([]) }} style={{
              padding: '8px 20px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
              border: `1px solid ${editType === tp ? 'var(--accent)' : 'var(--border)'}`,
              background: editType === tp ? 'var(--accent)' : 'none',
              color: editType === tp ? 'var(--accent-text)' : 'var(--fg-6)',
              fontWeight: editType === tp ? 600 : 400,
            }}>
              {tp === 'RANKED' ? t.typeRanked : t.typeTier}
            </button>
          ))}
        </div>

        {editType === 'RANKED' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-7)', marginBottom: 10 }}>{t.availableResources}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {resources.map(r => {
                  const added = rankedSelected.includes(r.id)
                  return (
                    <button key={r.id} onClick={() => added ? removeRanked(r.id) : addRanked(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${added ? 'var(--accent-muted)' : 'var(--border)'}`, background: added ? 'var(--accent-faint)' : 'var(--bg-deep)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 20 }}>{r.emoji}</span>
                      <span style={{ fontSize: 13, color: added ? 'var(--accent-fg)' : 'var(--fg-2)', flex: 1 }}>{r.title}</span>
                      <span style={{ fontSize: 18, color: added ? 'var(--accent-fg)' : 'var(--fg-8)' }}>{added ? '✓' : '+'}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-7)', marginBottom: 10 }}>{t.myRanking} ({editItems.length})</div>
              {editItems.length === 0 ? (
                <p style={{ color: 'var(--fg-7)', fontSize: 13 }}>{t.clickToAdd}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editItems.map((item, idx) => {
                    const r = getRes(item.resourceId)
                    if (!r) return null
                    return (
                      <div key={item.resourceId}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: expandedNote === item.resourceId ? '8px 8px 0 0' : 8 }}>
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 18, color: idx < 3 ? 'var(--accent-fg)' : 'var(--fg-7)', minWidth: 24, textAlign: 'center' }}>{idx + 1}</span>
                          <span style={{ fontSize: 18 }}>{r.emoji}</span>
                          <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{r.title}</span>
                          <button onClick={() => setExpandedNote(expandedNote === item.resourceId ? null : item.resourceId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: item.note ? '#f5a623' : 'var(--fg-7)', padding: '0 2px' }}>✏️</button>
                          <button onClick={() => move(item.resourceId, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--fg-9)' : 'var(--fg-6)', fontSize: 14, padding: '0 2px' }}>▲</button>
                          <button onClick={() => move(item.resourceId, 1)} disabled={idx === editItems.length - 1} style={{ background: 'none', border: 'none', cursor: idx === editItems.length - 1 ? 'default' : 'pointer', color: idx === editItems.length - 1 ? 'var(--fg-9)' : 'var(--fg-6)', fontSize: 14, padding: '0 2px' }}>▼</button>
                          <button onClick={() => removeRanked(item.resourceId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 16, padding: '0 2px' }}>×</button>
                        </div>
                        {expandedNote === item.resourceId && (
                          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 14px' }}>
                            <input value={item.note ?? ''} onChange={e => updateNote(item.resourceId, e.target.value)} placeholder={t.addNoteHint} style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
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
                  <div style={{ flex: 1, minHeight: 40, background: 'var(--bg-deep)', border: '1px solid var(--bg-input)', borderRadius: 8, padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {tierItems.map(item => {
                      const r = getRes(item.resourceId)
                      if (!r) return null
                      return (
                        <div key={item.resourceId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', borderRadius: 6, padding: '4px 10px' }}>
                            <span style={{ fontSize: 16 }}>{r.emoji}</span>
                            <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{r.title}</span>
                            <button onClick={() => setExpandedNote(expandedNote === item.resourceId ? null : item.resourceId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: item.note ? '#f5a623' : 'var(--fg-8)', padding: 0 }}>✏️</button>
                            <button onClick={() => assignTier(item.resourceId, tier)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-7)', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </div>
                          {expandedNote === item.resourceId && (
                            <input value={item.note ?? ''} onChange={e => updateNote(item.resourceId, e.target.value)} placeholder={t.addNoteHint} style={{ background: 'var(--bg-input)', border: 'none', outline: 'none', color: 'var(--fg-2)', fontSize: 11, fontFamily: 'inherit', borderRadius: 4, padding: '3px 8px', width: 140 }} />
                          )}
                        </div>
                      )
                    })}
                    {tierItems.length === 0 && <span style={{ color: 'var(--fg-9)', fontSize: 12 }}>—</span>}
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-8)', marginBottom: 8 }}>{t.noTier}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {resources.filter(r => !editItems.some(i => i.resourceId === r.id)).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ fontSize: 16 }}>{r.emoji}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{r.title}</span>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                      {TIERS.map(tier => (
                        <button key={tier} onClick={() => assignTier(r.id, tier)} style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${TIER_COLOR[tier]}44`, background: `${TIER_COLOR[tier]}11`, color: TIER_COLOR[tier], fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tier}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {resources.every(r => editItems.some(i => i.resourceId === r.id)) && (
                  <span style={{ color: 'var(--fg-8)', fontSize: 12 }}>{t.allClassified}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={handleSave} disabled={isPending} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1 }}>
            {isPending ? t.saving : t.save}
          </button>
          <button onClick={() => setMode('view')} disabled={isPending} style={{ padding: '9px 22px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-6)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            {t.cancel}
          </button>
          {myList && (
            <button onClick={() => { setEditItems([]); handleSave() }} disabled={isPending} style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: 8, border: '1px solid #f57c7c44', background: 'none', color: '#f57c7c', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              {t.deleteList}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOpen ? 20 : 0 }}>
        <button onClick={() => setIsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0, fontFamily: 'inherit' }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-5)', fontWeight: 600 }}>{t.personalRankings}</span>
          {userLists.length > 0 && <span style={{ fontSize: 11, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px', color: 'var(--fg-6)' }}>{userLists.length}</span>}
          <span style={{ fontSize: 10, color: 'var(--fg-7)', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {isLoggedIn && isOpen && (
          <button onClick={startEdit} style={{ padding: '6px 16px', borderRadius: 8, border: '1px dashed var(--fg-8)', background: 'none', color: 'var(--fg-6)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
            {myList ? t.editList : t.createList}
          </button>
        )}
      </div>

      {isOpen && ([...(myList ? [myList] : []), ...otherLists].length === 0 ? (
        <p style={{ color: 'var(--fg-7)', fontSize: 13 }}>
          {isLoggedIn ? t.beFirst : t.noPersRankings}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[...(myList ? [myList] : []), ...otherLists].map(list => {
            const ac = AVATAR_COLORS[list.userName.charCodeAt(0) % 4]
            const isMe = list.userId === currentUserId
            return card(
              <div key={list.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, background: `${ac}22`, color: ac, fontFamily: "'Fraunces', serif", flexShrink: 0, border: `1px solid ${ac}44` }}>
                    {list.userName[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>{list.userName}</span>
                    {isMe && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--accent-faint)', border: '1px solid var(--accent-muted)', borderRadius: 10, padding: '1px 7px', color: 'var(--accent-fg)', fontWeight: 500 }}>{t.me}</span>}
                  </div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 9px', borderRadius: 20, background: list.type === 'RANKED' ? 'var(--accent-faint)' : 'rgba(124,109,240,.1)', color: list.type === 'RANKED' ? 'var(--accent-fg)' : '#7c6df0', border: `1px solid ${list.type === 'RANKED' ? 'var(--accent-muted)' : 'rgba(124,109,240,.25)'}`, fontWeight: 500 }}>
                    {list.type === 'RANKED' ? t.ranked : t.tier}
                  </span>
                </div>

                {list.type === 'RANKED' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[...list.items]
                      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                      .map((item, idx) => (
                        <div key={item.resourceId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: idx === 0 ? 'var(--accent-faint)' : idx < 3 ? 'var(--bg-subtle)' : 'transparent', border: `1px solid ${idx === 0 ? 'var(--accent-muted)' : idx < 3 ? 'var(--border)' : 'transparent'}` }}>
                            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: idx === 0 ? 20 : idx === 1 ? 17 : idx === 2 ? 15 : 13, color: idx === 0 ? 'var(--accent-fg)' : idx < 3 ? 'var(--fg-4)' : 'var(--fg-8)', minWidth: 26, textAlign: 'center', lineHeight: 1 }}>{idx + 1}</span>
                            <span style={{ fontSize: idx === 0 ? 20 : 16 }}>{item.resource.emoji}</span>
                            <span style={{ fontSize: 13, color: idx < 3 ? 'var(--fg)' : 'var(--fg-3)', fontWeight: idx < 3 ? 500 : 400, flex: 1 }}>{item.resource.title}</span>
                          </div>
                          {item.note && <p style={{ margin: '3px 0 4px 46px', fontSize: 12, color: 'var(--fg-6)', fontStyle: 'italic' }}>{item.note}</p>}
                        </div>
                      ))}
                  </div>
                )}

                {list.type === 'TIER' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {TIERS.filter(tier => list.items.some(i => i.tier === tier)).map(tier => (
                      <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 16, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                          {list.items.filter(i => i.tier === tier).map(item => (
                            <div key={item.resourceId}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${TIER_COLOR[tier]}11`, border: `1px solid ${TIER_COLOR[tier]}33`, borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--fg-2)' }}>
                                <span>{item.resource.emoji}</span>
                                <span>{item.resource.title}</span>
                              </div>
                              {item.note && <p style={{ margin: '2px 0 0 4px', fontSize: 11, color: 'var(--fg-6)', fontStyle: 'italic' }}>{item.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>,
              isMe
            )
          })}
        </div>
      ))}
    </div>
  )
}
