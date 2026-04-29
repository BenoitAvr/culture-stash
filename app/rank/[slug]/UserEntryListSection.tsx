'use client'

import React, { useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { RankingEditor, type RankEditItem } from '@/app/components/RankingEditor'
import type { Dict } from '@/dictionaries/client'

type EntryItem = { id: string; title: string; year: number | null }

type ListItemData = {
  entryId: string
  position: number | null
  tier: string | null
  note: string | null
  entry: { id: string; title: string; year: number | null; cover: string | null }
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

function Poster({ src, title, tier, w }: { src: string | null; title: string; tier: string; w: number }) {
  const h = Math.round(w * 1.45)
  if (src) return <img src={src} alt={title} loading="lazy" style={{ width: w, height: h, objectFit: 'cover', borderRadius: 3, flexShrink: 0, display: 'block' }} />
  return (
    <div style={{ width: w, height: h, borderRadius: 3, flexShrink: 0, background: `${TIER_COLOR[tier]}18`, border: `1px solid ${TIER_COLOR[tier]}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: w * 0.35, color: TIER_COLOR[tier] }}>
      {title[0]?.toUpperCase()}
    </div>
  )
}

function CopyLinkButton({ lang, topicSlug, userId }: { lang: string; topicSlug: string; userId: string }) {
  const [state, setState] = useState<'idle' | 'copied'>('idle')
  function handleCopy() {
    const url = `${window.location.origin}/${lang}/rank/${topicSlug}/${userId}`
    navigator.clipboard.writeText(url).then(() => {
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copier le lien de partage"
      style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: state === 'copied' ? 'var(--accent-faint)' : 'none', color: state === 'copied' ? 'var(--accent-fg)' : 'var(--fg-6)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s' }}
    >
      {state === 'copied' ? '✓ Lien copié' : '↗ Partager'}
    </button>
  )
}

export function UserEntryListSection({
  topicSlug, topicTitle, entries, lists, onListsChange, currentUserId, isLoggedIn, t,
}: {
  topicSlug: string
  topicTitle: string
  entries: EntryItem[]
  lists: UserEntryListData[]
  onListsChange: (l: UserEntryListData[]) => void
  currentUserId: string | null
  isLoggedIn: boolean
  t: Dict['rankings']
}) {
  const { lang } = useParams() as { lang: string }
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const myTierList = lists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  async function handleSave(tier: RankEditItem[], rankedTiers: string[]) {
    const updated = await saveUserEntryLists(
      topicSlug,
      [],
      tier.map(i => ({ entryId: i.id, tier: i.tier, position: i.position, note: i.note })),
      rankedTiers
    )
    onListsChange([...lists.filter(l => l.userId !== currentUserId), ...updated])
    setIsEditing(false)
  }

  async function handleDelete() {
    await saveUserEntryLists(topicSlug, [], [], [])
    onListsChange(lists.filter(l => l.userId !== currentUserId))
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
      <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeTiers.slice(0, 3).map(tier => {
          const tItems = list.items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 20, height: 20, borderRadius: 3, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 7.5, color: TIER_COLOR[tier], flexShrink: 0 }}>{tier}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {tItems.slice(0, 8).map(item => (
                  <Poster key={item.entryId} src={item.entry.cover} title={item.entry.title} tier={tier} w={28} />
                ))}
                {tItems.length > 8 && <span style={{ fontSize: 10, color: 'var(--fg-8)', alignSelf: 'center', paddingLeft: 2 }}>+{tItems.length - 8}</span>}
              </div>
            </div>
          )
        })}
        {activeTiers.length > 3 && <span style={{ fontSize: 11, color: 'var(--fg-8)', paddingLeft: 27 }}>…</span>}
      </div>
    )
  }

  function renderTierItems(items: ListItemData[], rts: string[]) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TIERS.filter(tier => items.some(i => i.tier === tier)).map(tier => {
          const tItems = items.filter(i => i.tier === tier).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          const isRanked = rts.includes(tier)
          const viewOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce((sum, t) => sum + items.filter(i => i.tier === t).length, 0)
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 72, height: 30, borderRadius: 5, background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 9, color: TIER_COLOR[tier], flexShrink: 0, padding: '0 6px' }}>{TIER_LABEL[tier]}</div>
              {isRanked ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {tItems.map((item, idx) => (
                    <div key={item.entryId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 12, color: (viewOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-8)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{viewOffset + idx + 1}</span>
                      <Poster src={item.entry.cover} title={item.entry.title} tier={tier} w={32} />
                      <span style={{ fontSize: 13, color: 'var(--fg-2)', flex: 1 }}>{item.entry.title}</span>
                      {item.entry.year && <span style={{ fontSize: 11, color: 'var(--fg-8)', flexShrink: 0 }}>{item.entry.year}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
                  {tItems.map(item => (
                    <div key={item.entryId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }}>
                      <Poster src={item.entry.cover} title={item.entry.title} tier={tier} w={58} />
                      <span style={{ fontSize: 10, color: 'var(--fg-5)', textAlign: 'center', lineHeight: 1.25, width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{item.entry.title}</span>
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

  if (!isLoggedIn) {
    return (
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '28px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: 'var(--fg)', marginBottom: 6 }}>
            Crée mon classement
          </div>
          <p style={{ fontSize: 13, color: 'var(--fg-5)', margin: 0, lineHeight: 1.5 }}>
            Classe tes {topicTitle.toLowerCase()}, compare tes goûts avec la communauté.
          </p>
        </div>
        <Link
          href={`/${lang}/auth/login?redirect=${encodeURIComponent(pathname)}`}
          style={{ display: 'inline-block', padding: '10px 22px', borderRadius: 9, background: 'var(--btn)', color: 'var(--btn-text)', fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOpen ? 20 : myTierList ? 10 : 0 }}>
        <button onClick={() => setIsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: 0, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)' }}>{t.personalRankings}</span>
          <span style={{ fontSize: 9, color: 'var(--fg-7)', transition: 'transform .15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {myTierList && currentUserId && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button onClick={copyMarkdown} title="Copier ma liste (markdown)" style={{ padding: '4px 7px', borderRadius: 6, border: 'none', background: 'none', color: copied ? 'var(--accent-fg)' : 'var(--fg-8)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
              {copied ? '✓' : '⎘'}
            </button>
            <CopyLinkButton lang={lang} topicSlug={topicSlug} userId={currentUserId} />
            <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
            <button
              onClick={() => setIsEditing(true)}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-5)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Modifier ma liste
            </button>
          </div>
        )}
      </div>

      {!myTierList && (
        <div style={{ borderRadius: 14, border: '1px dashed var(--border)', padding: '28px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: 'var(--fg)', marginBottom: 6 }}>
              Crée mon classement
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg-5)', margin: 0, lineHeight: 1.5 }}>
              Classe tes {topicTitle.toLowerCase()} par tier, avec un rang optionnel.
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Commencer
          </button>
        </div>
      )}

      {!isOpen && myTierList && (
        <div style={{ marginBottom: 4 }}>{renderPreview(myTierList)}</div>
      )}

      {isOpen && myTierList && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-muted)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
          {renderTierItems(myTierList.items, (myTierList.rankedTiers ?? '').split(',').filter(Boolean))}
        </div>
      )}
    </div>
  )
}
