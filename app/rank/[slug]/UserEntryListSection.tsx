'use client'

import { useState } from 'react'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { RankingEditor, type RankEditItem } from '@/app/components/RankingEditor'
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

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#5b8dee', TB: '#388e3c', BO: '#66bb6a', AB: '#a3c940', PA: '#f9c933', IN: '#f5a623', MA: '#e05555',
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
  const [lists, setLists] = useState<UserEntryListData[]>(userEntryLists)
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const myTierList = lists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null
  const tierUserIds = [...new Set(lists.filter(l => l.type === 'TIER' || l.type === 'BOTH').map(l => l.userId))]
  const sortedUserIds = [
    ...tierUserIds.filter(id => id === currentUserId),
    ...tierUserIds.filter(id => id !== currentUserId),
  ]

  async function handleSave(tier: RankEditItem[], rankedTiers: string[]) {
    const updated = await saveUserEntryLists(
      topicSlug,
      [],
      tier.map(i => ({ entryId: i.id, tier: i.tier, position: i.position, note: i.note })),
      rankedTiers
    )
    setLists(prev => [...prev.filter(l => l.userId !== currentUserId), ...updated])
    setIsEditing(false)
  }

  async function handleDelete() {
    await saveUserEntryLists(topicSlug, [], [], [])
    setLists(prev => prev.filter(l => l.userId !== currentUserId))
    setIsEditing(false)
  }

  function buildMarkdown() {
    if (!myTierList) return ''
    const rts = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    const lines = [`# ${topicTitle} — Ma tier list\n`]
    TIERS.filter(tier => myTierList.items.some(i => i.tier === tier)).forEach(tier => {
      const tItems = myTierList.items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      if (rts.includes(tier)) {
        lines.push(`\n**${TIER_LABEL[tier]}** (classé)`)
        tItems.forEach((item, idx) => {
          lines.push(`${idx + 1}. ${item.entry.title}${item.entry.year ? ` (${item.entry.year})` : ''}`)
          if (item.note) lines.push(`   > ${item.note}`)
        })
      } else {
        lines.push(`**${TIER_LABEL[tier]}** — ${tItems.map(i => i.entry.title).join(', ')}`)
      }
    })
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
    const initTierItems = myTierList
      ? myTierList.items.map(i => ({ id: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined, note: i.note ?? undefined }))
      : []
    const initRankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
    return (
      <RankingEditor
        items={entries.map(e => ({ id: e.id, label: e.title, suffix: e.year?.toString() }))}
        initialTierItems={initTierItems}
        initialRankedTiers={initRankedTiers}
        hasExisting={!!myTierList}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        onDelete={myTierList ? handleDelete : undefined}
        t={t}
      />
    )
  }

  /* ─────────────── View mode ─────────────── */
  function renderPreview(list: UserEntryListData) {
    const activeTiers = TIERS.filter(t => list.items.some(i => i.tier === t))
    return (
      <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {activeTiers.slice(0, 3).map(tier => {
          const tItems = list.items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
              <span style={{ width: 20, height: 20, borderRadius: 4, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 7.5, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tItems.map(i => i.entry.title).join('  ·  ')}
              </span>
            </div>
          )
        })}
        {activeTiers.length > 3 && <span style={{ fontSize: 11, color: 'var(--fg-8)', paddingLeft: 27 }}>…</span>}
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
              <div style={{ minWidth: 72, height: 26, borderRadius: 5, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 9, color: TIER_COLOR[tier], flexShrink: 0, padding: '0 6px' }}>{TIER_LABEL[tier]}</div>
              {isRanked ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tItems.map((item, idx) => (
                    <div key={item.entryId} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 13, color: (viewOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 16, textAlign: 'right' }}>{viewOffset + idx + 1}</span>
                      <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.entry.title}</span>
                      {item.entry.year && <span style={{ fontSize: 11, color: 'var(--fg-8)' }}>{item.entry.year}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
                  {tItems.map(item => (
                    <span key={item.entryId} style={{ background: 'var(--bg-subtle)', borderRadius: 5, padding: '2px 9px', fontSize: 12, color: 'var(--fg-2)' }}>{item.entry.title}</span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOpen ? 20 : myTierList ? 10 : 0 }}>
        <button onClick={() => setIsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: 0, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)' }}>{t.personalRankings}</span>
          <span style={{ fontSize: 9, color: 'var(--fg-7)', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          {sortedUserIds.length > 0 && <span style={{ fontSize: 11, color: 'var(--fg-8)', fontFamily: 'inherit' }}>({sortedUserIds.length})</span>}
        </button>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {isLoggedIn && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {myTierList && (
              <button onClick={copyMarkdown} title="Copier ma liste" style={{ padding: '4px 7px', borderRadius: 6, border: 'none', background: 'none', color: copied ? 'var(--accent-fg)' : 'var(--fg-8)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
                {copied ? '✓' : '⎘'}
              </button>
            )}
            <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
            <button
              onClick={() => setIsEditing(true)}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-5)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {myTierList ? 'Modifier ma liste' : '+ Ma liste'}
            </button>
          </div>
        )}
      </div>

      {!isOpen && myTierList && (
        <div style={{ marginBottom: 4 }}>{renderPreview(myTierList)}</div>
      )}

      {isOpen && (sortedUserIds.length === 0 ? (
        <p style={{ color: 'var(--fg-7)', fontSize: 13, padding: '20px 0' }}>{isLoggedIn ? t.beFirst : t.noPersRankings}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedUserIds.map(uid => {
            const tierList = lists.find(l => l.userId === uid && (l.type === 'TIER' || l.type === 'BOTH'))!
            const ac = AVATAR_COLORS[tierList.userName.charCodeAt(0) % 4]
            const isMe = uid === currentUserId
            const rts = (tierList.rankedTiers ?? '').split(',').filter(Boolean)
            return (
              <div key={uid} style={{ background: 'var(--bg-card)', border: `1px solid ${isMe ? 'var(--accent-muted)' : 'var(--border)'}`, borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: `${ac}22`, color: ac, fontFamily: "'Fraunces', serif", flexShrink: 0 }}>
                    {tierList.userName[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--fg)', fontWeight: 500, flex: 1 }}>{tierList.userName}</span>
                  {isMe && <span style={{ fontSize: 11, color: 'var(--fg-7)', fontStyle: 'italic' }}>{t.me}</span>}
                </div>
                {renderTierItems(tierList.items, rts)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
