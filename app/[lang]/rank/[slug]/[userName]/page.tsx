import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { pickTitle } from '@/lib/i18n'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string; userName: string }> }): Promise<Metadata> {
  const { lang, slug, userName } = await params
  const decodedUsername = decodeURIComponent(userName)
  const list = await prisma.userEntryList.findFirst({
    where: { topic: { slug }, user: { username: decodedUsername }, type: { in: ['TIER', 'BOTH'] } },
    include: {
      user: { select: { name: true } },
      topic: { include: { translations: { where: { lang } } } },
    },
  })
  if (!list) return {}
  const tr = list.topic.translations[0]
  const topicTitle = tr?.title ?? list.topic.title
  const isFr = lang === 'fr'
  return {
    title: isFr ? `Tier list de ${list.user.name} — ${topicTitle}` : `${list.user.name}'s tier list — ${topicTitle}`,
    description: isFr
      ? `Découvre la tier list ${list.topic.emoji} ${topicTitle} de ${list.user.name}.`
      : `See ${list.user.name}'s ${list.topic.emoji} ${topicTitle} tier list.`,
  }
}

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

async function UserListInner({
  params,
}: {
  params: Promise<{ lang: string; slug: string; userName: string }>
}) {
  const { lang, slug, userName } = await params
  if (!hasLocale(lang)) notFound()

  const decodedUsername = decodeURIComponent(userName)
  const dict = getDictionary(lang)

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: { translations: { where: { lang } } },
  })
  if (!topic || !topic.rankable) notFound()

  const list = await prisma.userEntryList.findFirst({
    where: { topicId: topic.id, user: { username: decodedUsername }, type: { in: ['TIER', 'BOTH'] } },
    include: {
      user: { select: { name: true } },
      items: {
        include: { entry: { select: { id: true, title: true, titleEn: true, year: true, cover: true, kind: true } } },
        orderBy: { position: 'asc' },
      },
    },
  })
  if (!list) notFound()

  const tr = topic.translations[0]
  const topicTitle = tr?.title ?? topic.title
  const rts = (list.rankedTiers ?? '').split(',').filter(Boolean)
  const activeTiers = TIERS.filter(tier => list.items.some(i => i.tier === tier))

  return (
    <div className="page-md" style={{ margin: '0 auto', padding: '0 20px 60px' }}>

      {/* Breadcrumb */}
      <div style={{ padding: '28px 0 24px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href={`/${lang}/rank`} style={{ fontSize: 12, color: 'var(--fg-5)', textDecoration: 'none' }}>
          {lang === 'fr' ? 'Classer' : 'Rank'}
        </Link>
        <span style={{ color: 'var(--fg-9)' }}>/</span>
        <Link href={`/${lang}/rank/${slug}`} style={{ fontSize: 12, color: 'var(--fg-5)', textDecoration: 'none' }}>
          {topic.emoji} {topicTitle}
        </Link>
        <span style={{ color: 'var(--fg-9)' }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--fg-5)' }}>{list.user.name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 40 }}>{topic.emoji}</span>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: 'var(--fg)', letterSpacing: -0.5, lineHeight: 1.1, margin: 0 }}>{topicTitle}</h1>
            <p style={{ fontSize: 13, color: 'var(--fg-5)', margin: '4px 0 0' }}>
              {lang === 'fr' ? 'Tier list de' : 'Tier list by'}{' '}
              <span style={{ color: 'var(--fg-3)', fontWeight: 600 }}>{list.user.name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tier list — vertical rank groups (same semantic as the editor) */}
      {activeTiers.length === 0 ? (
        <p style={{ color: 'var(--fg-5)', fontSize: 14 }}>
          {lang === 'fr' ? 'Cette liste est vide.' : 'This list is empty.'}
        </p>
      ) : (
        <div>
          {TIERS.filter(t => activeTiers.includes(t)).map(tier => {
            const tItems = list.items.filter(i => i.tier === tier)
              .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
            const isLegacyVrac = !rts.includes(tier)
            // Count prior tiers' distinct rank groups and items so this tier's
            // displayed ranks continue the global sequence (EX #1, #2, then
            // TB's first group becomes global #3, etc.).
            let priorGroupCount = 0
            let priorItemCount = 0
            for (const t of TIERS) {
              if (t === tier) break
              const inT = list.items.filter(i => i.tier === t)
              if (inT.length === 0) continue
              const isLegacyVracPrior = !rts.includes(t)
              if (isLegacyVracPrior) {
                priorGroupCount += 1
              } else {
                priorGroupCount += new Set(inT.map(i => i.position ?? 1)).size
              }
              priorItemCount += inT.length
            }
            type Group = { rank: number; items: typeof tItems; fractional: number }
            const groups: Group[] = []
            let runningPos = priorItemCount + 1
            if (isLegacyVrac) {
              const positions: number[] = []
              for (let i = 0; i < tItems.length; i++) positions.push(runningPos++)
              const avg = positions.reduce((s, p) => s + p, 0) / Math.max(1, positions.length)
              if (tItems.length > 0) groups.push({ rank: priorGroupCount + 1, items: tItems, fractional: avg })
            } else {
              // Collect by stored tie value
              let prevStored: number | null = null
              const tieBuckets: Array<typeof tItems> = []
              for (const it of tItems) {
                const stored = it.position ?? null
                if (stored !== null && stored === prevStored && tieBuckets.length > 0) {
                  tieBuckets[tieBuckets.length - 1].push(it)
                } else {
                  tieBuckets.push([it])
                }
                prevStored = stored
              }
              tieBuckets.forEach((bucket, gIdx) => {
                const occupied: number[] = []
                for (let i = 0; i < bucket.length; i++) occupied.push(runningPos++)
                groups.push({
                  rank: priorGroupCount + gIdx + 1,
                  items: bucket,
                  fractional: occupied.reduce((s, p) => s + p, 0) / occupied.length,
                })
              })
            }
            const tierColor = TIER_COLOR[tier]
            return (
              <div key={tier} className="tier-row">
                <div className="tier-label" title={`${TIER_LABEL[tier]} — ${TIER_SUBJECTIVE[tier]}`} style={{
                  minHeight: 44, borderRadius: 6,
                  background: `${tierColor}1a`, border: `1px solid ${tierColor}55`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  color: tierColor, textAlign: 'center', padding: '6px 8px',
                }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 17, lineHeight: 1.05 }}>
                    {TIER_LABEL[tier]}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.25, opacity: 0.82 }}>
                    {TIER_SUBJECTIVE[tier]}
                  </span>
                  {tItems.length > 0 && (
                    <span style={{
                      marginTop: 2, fontSize: 9.5, fontWeight: 700,
                      letterSpacing: '.04em', textTransform: 'uppercase',
                      opacity: 0.65, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {tItems.length} film{tItems.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="tier-dropzone" style={{
                  minHeight: 44, background: 'transparent',
                  border: '1px solid transparent', borderRadius: 6,
                  padding: '0 6px',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {groups.map((g, gIdx) => {
                    const isTied = g.items.length > 1
                    const badgeBg = '#1f2937'
                    const medalRing = g.rank === 1 ? '#f59e0b'
                      : g.rank === 2 ? '#94a3b8'
                      : g.rank === 3 ? '#b45309'
                      : null
                    return (
                      <div key={g.rank} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0 4px',
                        marginTop: gIdx === 0 ? 0 : -1,
                        borderRadius: 6,
                        background: isTied ? `${tierColor}0a` : 'transparent',
                        borderLeft: isTied ? `3px solid ${tierColor}66` : '3px solid transparent',
                      }}>
                        <div
                          aria-label={`Rang ${g.rank}${isTied ? `, ex-æquo (${g.items.length}), rang officiel ${g.fractional.toFixed(1)}` : ''}`}
                          title={isTied ? `${g.items.length} films ex-æquo à ce rang · rang officiel ⌀${g.fractional.toFixed(1)}` : undefined}
                          style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            minWidth: medalRing ? 34 : 30,
                            height: medalRing ? 34 : 30,
                            padding: '0 6px',
                            borderRadius: 999,
                            background: badgeBg,
                            color: '#fff',
                            boxShadow: medalRing
                              ? `0 0 0 2px ${medalRing}, 0 2px 6px ${medalRing}55`
                              : '0 1px 3px rgba(0,0,0,.18)',
                            flexShrink: 0,
                            marginLeft: medalRing ? 4 : 2,
                            border: isTied && !medalRing ? `1.5px solid ${tierColor}55` : 'none',
                          }}
                        >
                          <span style={{
                            fontFamily: "'Fraunces', serif",
                            fontWeight: 900,
                            fontSize: 13,
                            lineHeight: 1,
                            letterSpacing: -0.5,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {g.rank}
                          </span>
                          {isTied && (
                            <span style={{
                              fontSize: 7.5,
                              opacity: 0.75,
                              lineHeight: 1,
                              marginTop: 1,
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 500,
                              letterSpacing: 0.2,
                            }}>
                              ⌀{g.fractional.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const showInline = g.items.length <= 2
                          const cardW = showInline ? 27 : 46
                          const placeholderFs = showInline ? 11 : 14
                          const solo = g.items.length === 1
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: showInline ? 8 : 2, flex: 1, alignItems: 'stretch' }}>
                              {g.items.map(item => {
                                const label = pickTitle(item.entry, lang)
                                const isSaga = (item.entry as { kind?: string }).kind === 'SAGA'
                                const posterInner = (
                                  <div style={{
                                    position: 'relative', width: cardW, flexShrink: 0,
                                    aspectRatio: '2 / 3', background: 'var(--bg-subtle)', overflow: 'hidden',
                                  }}>
                                    {item.entry.cover
                                      ? <img src={item.entry.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: placeholderFs, color: 'var(--fg-7)' }}>{label.charAt(0).toUpperCase()}</div>
                                    }
                                    {isSaga && !showInline && (
                                      <span
                                        aria-label="Collection"
                                        style={{
                                          position: 'absolute', bottom: 0, left: 0, right: 0,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          padding: '2px 1px',
                                          background: 'rgba(79, 70, 229, 0.92)',
                                          color: '#fff',
                                          fontSize: 6.5, fontWeight: 800, letterSpacing: 0,
                                          textShadow: '0 1px 2px rgba(0,0,0,.5)',
                                          lineHeight: 1,
                                        }}
                                      >
                                        COLLECTION
                                      </span>
                                    )}
                                  </div>
                                )
                                const cardStyle: React.CSSProperties = {
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  userSelect: 'none',
                                }
                                const sagaChip = isSaga ? (
                                  <span title="Collection — série de films regroupés" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 8.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 3, background: 'var(--accent-faint)', color: 'var(--accent-fg)', border: '1px solid var(--accent-muted)', flexShrink: 0 }}>
                                    Collection
                                  </span>
                                ) : null
                                if (showInline) {
                                  return (
                                    <div key={item.entryId} title={label} style={{ ...cardStyle, display: 'flex', alignItems: 'stretch', flex: '1 1 0', minWidth: 220, maxWidth: solo ? 900 : 480 }}>
                                      {posterInner}
                                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, padding: '0 10px', gap: 6 }}>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                                          {label}
                                        </span>
                                        {sagaChip}
                                        {!isSaga && item.entry.year != null && (
                                          <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                            {item.entry.year}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }
                                return (
                                  <div key={item.entryId} title={label} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', width: cardW }}>
                                    {posterInner}
                                    <div style={{ padding: '2px 3px 3px', fontSize: 8.5, color: 'var(--fg-4)', lineHeight: 1.15, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as React.CSSProperties}>
                                      {label}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer link */}
      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <Link href={`/${lang}/rank/${slug}`} style={{ fontSize: 13, color: 'var(--fg-5)', textDecoration: 'none' }}>
          ← {lang === 'fr' ? 'Voir le classement communautaire' : 'See community ranking'}
        </Link>
      </div>
    </div>
  )
}

export default function UserListPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; userName: string }>
}) {
  return (
    <Suspense fallback={null}>
      <UserListInner params={params} />
    </Suspense>
  )
}
