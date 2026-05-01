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
        include: { entry: { select: { id: true, title: true, titleEn: true, year: true, cover: true } } },
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
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px 60px' }}>

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

      {/* Tier list */}
      {activeTiers.length === 0 ? (
        <p style={{ color: 'var(--fg-5)', fontSize: 14 }}>
          {lang === 'fr' ? 'Cette liste est vide.' : 'This list is empty.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeTiers.map(tier => {
            const tItems = list.items.filter(i => i.tier === tier)
            const isRanked = rts.includes(tier)
            const viewOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce(
              (sum, t) => sum + list.items.filter(i => i.tier === t).length, 0
            )
            return (
              <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  minWidth: 80, height: 30, borderRadius: 6,
                  background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 10,
                  color: TIER_COLOR[tier], flexShrink: 0, padding: '0 6px',
                }}>
                  {TIER_LABEL[tier]}
                </div>

                {isRanked ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
                    {tItems.map((item, idx) => (
                      <div key={item.entryId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 13,
                          color: (viewOffset + idx) < 3 ? 'var(--accent-fg)' : 'var(--fg-5)',
                          minWidth: 18, textAlign: 'right', flexShrink: 0,
                        }}>
                          {viewOffset + idx + 1}
                        </span>
                        {item.entry.cover
                          ? <img src={item.entry.cover} alt="" style={{ width: 34, height: 50, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                          : <div style={{ width: 34, height: 50, borderRadius: 3, flexShrink: 0, background: `${TIER_COLOR[tier]}18`, border: `1px solid ${TIER_COLOR[tier]}33` }} />
                        }
                        <span style={{ fontSize: 14, color: 'var(--fg-2)', flex: 1 }}>{pickTitle(item.entry, lang)}</span>
                        {item.entry.year && <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>{item.entry.year}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 2 }}>
                    {tItems.map(item => (
                      <div key={item.entryId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 74 }}>
                        {item.entry.cover
                          ? <img src={item.entry.cover} alt={pickTitle(item.entry, lang)} style={{ width: 68, height: 98, objectFit: 'cover', borderRadius: 4 }} />
                          : <div style={{ width: 68, height: 98, borderRadius: 4, background: `${TIER_COLOR[tier]}18`, border: `1px solid ${TIER_COLOR[tier]}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, color: TIER_COLOR[tier] }}>{pickTitle(item.entry, lang)[0]?.toUpperCase()}</div>
                        }
                        <span style={{ fontSize: 10, color: 'var(--fg-5)', textAlign: 'center', lineHeight: 1.25, width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {pickTitle(item.entry, lang)}{item.entry.year ? ` (${item.entry.year})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
