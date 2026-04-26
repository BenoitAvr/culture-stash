'use client'

import { useState } from 'react'
import { saveUserEntryList } from '@/app/actions/entryLists'
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
  const [copied, setCopied] = useState(false)

  const myRankedList = userEntryLists.find(l => l.userId === currentUserId && l.type === 'RANKED') ?? null
  const myTierList = userEntryLists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  // Pour la vue : grouper par userId (un user peut avoir deux listes)
  const userIds = [...new Set(userEntryLists.map(l => l.userId))]
  // currentUser en premier
  const sortedUserIds = [
    ...userIds.filter(id => id === currentUserId),
    ...userIds.filter(id => id !== currentUserId),
  ]

  async function handleSave(_mode: 'RANKED' | 'TIER', rank: RankEditItem[], tier: RankEditItem[], rankedTiers: string[]) {
    await saveUserEntryList(topicSlug, 'RANKED', rank.map(i => ({ entryId: i.id, position: i.position, note: i.note })))
    await saveUserEntryList(topicSlug, 'TIER', tier.map(i => ({ entryId: i.id, tier: i.tier, position: i.position, note: i.note })), rankedTiers)
    setIsEditing(false)
  }

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
      <RankingEditor
        items={entries.map(e => ({ id: e.id, label: e.title, suffix: e.year?.toString() }))}
        initialRankItems={myRankedList ? [...myRankedList.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map(i => ({ id: i.entryId, position: i.position ?? undefined, note: i.note ?? undefined })) : []}
        initialTierItems={myTierList ? myTierList.items.map(i => ({ id: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined, note: i.note ?? undefined })) : []}
        initialMode={myTierList ? 'TIER' : 'RANKED'}
        initialRankedTiers={(myTierList?.rankedTiers ?? '').split(',').filter(Boolean)}
        hasExisting={!!(myRankedList || myTierList)}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        t={t}
      />
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
                <button onClick={() => setIsEditing(true)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: (myRankedList || myTierList) ? 'none' : 'var(--bg-card)', color: 'var(--fg-5)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
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
