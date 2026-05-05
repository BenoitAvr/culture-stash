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

      {/* Tier list — same look as the editor (read-only) */}
      {activeTiers.length === 0 ? (
        <p style={{ color: 'var(--fg-5)', fontSize: 14 }}>
          {lang === 'fr' ? 'Cette liste est vide.' : 'This list is empty.'}
        </p>
      ) : (
        <div>
          {TIERS.filter(t => activeTiers.includes(t)).map(tier => {
            const tItems = list.items.filter(i => i.tier === tier)
              .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
            const isRanked = rts.includes(tier)
            const viewOffset = TIERS.slice(0, TIERS.indexOf(tier)).reduce(
              (sum, t) => sum + list.items.filter(i => i.tier === t).length, 0
            )
            return (
              <div key={tier} className="tier-row">
                <div className="tier-label" style={{
                  minHeight: 50, borderRadius: 6,
                  background: `${TIER_COLOR[tier]}22`, border: `1px solid ${TIER_COLOR[tier]}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 9.5,
                  color: TIER_COLOR[tier], textAlign: 'center', padding: '0 4px',
                }}>
                  {TIER_LABEL[tier]}
                </div>
                <div className="tier-dropzone" style={{
                  minHeight: 50, background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '12px 6px 6px',
                  display: 'flex', flexWrap: 'wrap', gap: 4,
                  alignItems: 'flex-start', alignContent: 'flex-start',
                }}>
                  {tItems.map((item, idx) => {
                    const position = isRanked ? viewOffset + idx + 1 : undefined
                    const label = pickTitle(item.entry, lang)
                    return (
                      <div key={item.entryId} title={label} style={{
                        position: 'relative', width: 50, flexShrink: 0,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: 2, userSelect: 'none',
                      }}>
                        <div style={{
                          position: 'relative', width: '100%', aspectRatio: '2 / 3',
                          background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden',
                        }}>
                          {item.entry.cover
                            ? <img src={item.entry.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 16, color: 'var(--fg-7)' }}>{label.charAt(0).toUpperCase()}</div>
                          }
                        </div>
                        {position !== undefined && (
                          <div style={{
                            position: 'absolute', top: -5, left: -5,
                            minWidth: 22, height: 22, padding: '0 5px',
                            borderRadius: 11,
                            background: position <= 3 ? 'var(--accent-fg)' : '#1a1a1a',
                            color: position <= 3 ? 'var(--btn-text)' : '#fff',
                            border: '2px solid var(--bg-card)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, fontFamily: "'Fraunces', serif",
                            boxShadow: '0 3px 8px rgba(0,0,0,.4)', zIndex: 3,
                          }}>{position}</div>
                        )}
                        <div style={{
                          marginTop: 2, fontSize: 8.5, color: 'var(--fg-4)', lineHeight: 1.15,
                          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', wordBreak: 'break-word',
                        } as React.CSSProperties}>
                          {label}
                        </div>
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
