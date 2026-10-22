'use client'

import React from 'react'
import { pickTitle } from '@/lib/i18n'
import type { GroupListItem } from '@/lib/groupData'

type EntryItem = { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null }

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_SUBJECTIVE: Record<string, string> = {
  EX: 'Chef-d’œuvre, m’a fasciné',
  TB: 'J’ai adoré, à revoir',
  BO: 'J’ai bien aimé',
  AB: 'Pas mal, sans plus',
  PA: 'Moyen, oubliable',
  IN: 'Déçu, raté',
  MA: 'Détesté, à éviter',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#5b8dee', TB: '#388e3c', BO: '#66bb6a', AB: '#a3c940', PA: '#f9c933', IN: '#f5a623', MA: '#e05555',
}

// Read-only mirror of RankingEditor's tier layout, used when the current user
// is viewing a group member's tier list through the GroupBar. Deliberately
// does not implement drag/drop, quick-add, or any save path — this view is
// strictly observational.
export function GroupMemberListView({
  memberName,
  items,
  entries,
  lang,
}: {
  memberName: string
  items: GroupListItem[]
  entries: EntryItem[]
  lang: string
}) {
  const entryById = new Map(entries.map(e => [e.id, e]))

  const inAnyTier = items.some(i => i.tier && TIERS.includes(i.tier))

  if (!inAnyTier) {
    return (
      <div style={{
        padding: '32px 20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textAlign: 'center',
        color: 'var(--fg-5)',
        fontSize: 14,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>🎬</div>
        {lang === 'fr'
          ? <><strong style={{ color: 'var(--fg-3)' }}>{memberName}</strong> n&apos;a pas encore classé de film pour ce groupe.</>
          : <><strong style={{ color: 'var(--fg-3)' }}>{memberName}</strong> hasn&apos;t ranked any films in this group yet.</>}
      </div>
    )
  }

  // Group items by tier, then by shared rank for the ties display.
  return (
    <div style={{ paddingBottom: 28 }}>
      <div>
        {TIERS.map(tier => {
          const inTier = items
            .filter(i => i.tier === tier)
            .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          const tierColor = TIER_COLOR[tier]

          // Rank groups (ties)
          const groups: Array<{ rank: number; items: GroupListItem[] }> = []
          for (const it of inTier) {
            const r = it.position ?? 1
            const last = groups[groups.length - 1]
            if (last && last.rank === r) last.items.push(it)
            else groups.push({ rank: r, items: [it] })
          }

          return (
            <div key={tier} className="tier-row">
              <div
                className="tier-label"
                title={`${TIER_LABEL[tier]} — ${TIER_SUBJECTIVE[tier]}`}
                style={{
                  minHeight: 44,
                  borderRadius: 6,
                  background: `${tierColor}1a`,
                  border: `1px solid ${tierColor}55`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 2,
                  color: tierColor,
                  textAlign: 'center',
                  padding: '5px 6px',
                }}
              >
                <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 15, lineHeight: 1.05 }}>
                  {TIER_LABEL[tier]}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2, opacity: 0.8 }}>
                  {TIER_SUBJECTIVE[tier]}
                </span>
                {inTier.length > 0 && (
                  <span style={{
                    marginTop: 1, fontSize: 9, fontWeight: 700,
                    letterSpacing: '.04em', textTransform: 'uppercase',
                    opacity: 0.6, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {inTier.length} film{inTier.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div
                className="tier-dropzone"
                style={{
                  minHeight: 44,
                  background: 'transparent',
                  borderRadius: 6,
                  padding: '0 6px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {groups.length === 0 ? (
                  <span style={{ color: 'var(--fg-6)', fontSize: 11.5, fontStyle: 'italic', alignSelf: 'center', margin: 'auto' }}>
                    —
                  </span>
                ) : groups.map(g => {
                  const isTied = g.items.length > 1
                  const showInline = g.items.length <= 2
                  return (
                    <div
                      key={g.rank}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0 4px', marginTop: 2,
                        borderRadius: 6,
                        background: isTied ? `${tierColor}0a` : 'transparent',
                        borderLeft: isTied ? `3px solid ${tierColor}66` : '3px solid transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 30, height: 30, padding: '0 6px',
                          borderRadius: 999,
                          background: '#1f2937',
                          color: '#fff', fontFamily: "'Fraunces', serif",
                          fontWeight: 900, fontSize: 13, lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                          boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                          flexShrink: 0, marginLeft: 2,
                        }}
                      >
                        {g.rank}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: showInline ? 8 : 2, flex: 1, alignItems: 'stretch' }}>
                        {g.items.map(item => {
                          const entry = entryById.get(item.entryId)
                          if (!entry) return null
                          const title = pickTitle(entry, lang)
                          const cardW = showInline ? 27 : 46
                          if (showInline) {
                            return (
                              <div key={item.entryId} style={{
                                display: 'flex', alignItems: 'stretch',
                                flex: '1 1 0', minWidth: 220, maxWidth: g.items.length === 1 ? 900 : 480,
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 6, overflow: 'hidden',
                              }}>
                                <div style={{ position: 'relative', width: cardW, flexShrink: 0, aspectRatio: '2 / 3', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                                  {entry.cover ? (
                                    <img src={entry.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 11, color: 'var(--fg-7)' }}>
                                      {title.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, padding: '0 10px', gap: 6 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                                    {title}
                                  </span>
                                  {entry.year != null && (
                                    <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                      {entry.year}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={item.entryId} title={title} style={{
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 6, overflow: 'hidden', width: cardW,
                              display: 'flex', flexDirection: 'column',
                            }}>
                              <div style={{ position: 'relative', width: cardW, flexShrink: 0, aspectRatio: '2 / 3', background: 'var(--bg-subtle)' }}>
                                {entry.cover ? (
                                  <img src={entry.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 14, color: 'var(--fg-7)' }}>
                                    {title.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div style={{ padding: '2px 3px 3px', fontSize: 8.5, color: 'var(--fg-4)', lineHeight: 1.15, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {title}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
