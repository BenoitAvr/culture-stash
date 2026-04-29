'use client'

import { useState } from 'react'
import { saveUserList } from '@/app/actions/lists'
import { RankingEditor, type RankEditItem } from '@/app/components/RankingEditor'
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
  rankedTiers: string | null
  items: ListItemData[]
}

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#5b8dee', TB: '#388e3c', BO: '#66bb6a', AB: '#a3c940', PA: '#f9c933', IN: '#f5a623', MA: '#e05555',
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
  const [isEditing, setIsEditing] = useState(false)

  const myList = userLists.find(l => l.userId === currentUserId) ?? null
  const otherLists = userLists.filter(l => l.userId !== currentUserId)

  const rankableItems = resources.map(r => ({ id: r.id, label: r.title, prefix: r.emoji }))

  const initialTierItems: RankEditItem[] = myList?.type === 'TIER'
    ? myList.items.map(i => ({ id: i.resourceId, tier: i.tier ?? undefined, position: i.position ?? undefined, note: i.note ?? undefined }))
    : []
  const initialRankedTiers = (myList?.rankedTiers ?? '').split(',').filter(Boolean)

  async function handleSave(tier: RankEditItem[], rankedTiers: string[]) {
    await saveUserList(
      topicSlug,
      'TIER',
      tier.map(i => ({ resourceId: i.id, position: i.position, tier: i.tier, note: i.note })),
      rankedTiers
    )
    setIsEditing(false)
  }

  async function handleDelete() {
    await saveUserList(topicSlug, 'TIER', [], [])
    setIsEditing(false)
  }

  function renderPreview(list: UserListData) {
    const rts = (list.rankedTiers ?? '').split(',').filter(Boolean)
    if (list.type === 'RANKED') {
      const top = [...list.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).slice(0, 5)
      return (
        <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {top.map((item, idx) => (
            <span key={item.resourceId} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px 3px 7px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--fg-5)' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 11, color: idx < 3 ? 'var(--accent-fg)' : 'var(--fg-5)' }}>{idx + 1}</span>
              <span>{item.resource.emoji}</span>
              <span style={{ color: 'var(--fg-4)' }}>{item.resource.title}</span>
            </span>
          ))}
          {list.items.length > 5 && <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>+{list.items.length - 5}</span>}
        </div>
      )
    }
    const activeTiers = TIERS.filter(t => list.items.some(i => i.tier === t))
    return (
      <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {activeTiers.slice(0, 3).map(tier => {
          const tItems = list.items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
              <span style={{ width: 20, height: 20, borderRadius: 4, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 7.5, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tItems.map(i => `${i.resource.emoji} ${i.resource.title}`).join('  ·  ')}
              </span>
            </div>
          )
        })}
        {activeTiers.length > 3 && <span style={{ fontSize: 11, color: 'var(--fg-5)', paddingLeft: 27 }}>…</span>}
      </div>
    )
  }

  if (isEditing) {
    return (
      <RankingEditor
        items={rankableItems}
        initialTierItems={initialTierItems}
        initialRankedTiers={initialRankedTiers}
        hasExisting={!!myList}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        onDelete={myList ? handleDelete : undefined}
        t={t}
      />
    )
  }

  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOpen ? 20 : userLists.length > 0 ? 10 : 0 }}>
        <button onClick={() => setIsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0, fontFamily: 'inherit' }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-5)', fontWeight: 600 }}>{t.personalRankings}</span>
          {userLists.length > 0 && <span style={{ fontSize: 11, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px', color: 'var(--fg-6)' }}>{userLists.length}</span>}
          <span style={{ fontSize: 10, color: 'var(--fg-7)', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {isLoggedIn && (
          <button onClick={() => setIsEditing(true)} style={{ padding: '5px 14px', borderRadius: 7, border: '1px dashed var(--fg-8)', background: 'none', color: 'var(--fg-6)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
            {myList ? t.editList : t.createList}
          </button>
        )}
      </div>

      {!isOpen && userLists.length > 0 && (
        <div style={{ marginBottom: 4 }}>{renderPreview(myList ?? userLists[0])}</div>
      )}

      {isOpen && ([...(myList ? [myList] : []), ...otherLists].length === 0 ? (
        <p style={{ color: 'var(--fg-5)', fontSize: 13 }}>
          {isLoggedIn ? t.beFirst : t.noPersRankings}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[...(myList ? [myList] : []), ...otherLists].map(list => {
            const ac = AVATAR_COLORS[list.userName.charCodeAt(0) % 4]
            const isMe = list.userId === currentUserId
            const rts = (list.rankedTiers ?? '').split(',').filter(Boolean)
            return (
              <div key={list.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isMe ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 12, boxShadow: 'var(--shadow)', padding: 18 }}>
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
                    {[...list.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((item, idx) => (
                      <div key={item.resourceId}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: idx === 0 ? 'var(--accent-faint)' : idx < 3 ? 'var(--bg-subtle)' : 'transparent', border: `1px solid ${idx === 0 ? 'var(--accent-muted)' : idx < 3 ? 'var(--border)' : 'transparent'}` }}>
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: idx === 0 ? 20 : idx === 1 ? 17 : idx === 2 ? 15 : 13, color: idx === 0 ? 'var(--accent-fg)' : idx < 3 ? 'var(--fg-4)' : 'var(--fg-5)', minWidth: 26, textAlign: 'center', lineHeight: 1 }}>{idx + 1}</span>
                          <span style={{ fontSize: idx === 0 ? 20 : 16 }}>{item.resource.emoji}</span>
                          <span style={{ fontSize: 13, color: idx < 3 ? 'var(--fg)' : 'var(--fg-3)', fontWeight: idx < 3 ? 500 : 400, flex: 1 }}>{item.resource.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {list.type === 'TIER' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {TIERS.filter(tier => list.items.some(i => i.tier === tier)).map(tier => {
                      const tItems = list.items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                      const isRanked = rts.includes(tier)
                      const viewOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce((sum, t) => sum + list.items.filter(i => i.tier === t).length, 0)
                      return (
                        <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ minWidth: 72, height: 32, borderRadius: 8, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 9.5, color: TIER_COLOR[tier], flexShrink: 0, padding: '0 6px' }}>{TIER_LABEL[tier]}</div>
                          {isRanked ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {tItems.map((item, idx) => (
                                <div key={item.resourceId}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 13, color: (viewOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-5)', minWidth: 16, textAlign: 'right' }}>{viewOffset + idx + 1}</span>
                                    <span style={{ fontSize: 14 }}>{item.resource.emoji}</span>
                                    <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.resource.title}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                              {tItems.map(item => (
                                <div key={item.resourceId}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${TIER_COLOR[tier]}11`, border: `1px solid ${TIER_COLOR[tier]}33`, borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--fg-2)' }}>
                                    <span>{item.resource.emoji}</span>
                                    <span>{item.resource.title}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
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
