import { prisma } from '@/lib/prisma'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { getCommunityData } from '@/lib/communityRankData'
import { combinedScore } from '@/lib/communityRankScore'
import { pickTitle } from '@/lib/i18n'

function getRankableTopics(lang: string) {
  return unstable_cache(
    async () => {
      return prisma.topic.findMany({
        where: { rankable: true },
        include: { _count: { select: { entries: true } }, translations: { where: { lang } } },
        orderBy: { createdAt: 'asc' },
      })
    },
    [`rank-topics-${lang}`],
    { tags: ['rank-topics'] }
  )()
}

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_VALUE: Record<string, number> = { EX: 7, TB: 6, BO: 5, AB: 4, PA: 3, IN: 2, MA: 1 }
const TIER_BY_VALUE: Record<number, string> = { 7: 'EX', 6: 'TB', 5: 'BO', 4: 'AB', 3: 'PA', 2: 'IN', 1: 'MA' }

const TIER_COLOR: Record<string, string> = {
  EX: '#3b82f6', TB: '#16a34a', BO: '#a3e635', AB: '#eab308', PA: '#f97316', IN: '#ef4444', MA: '#737373',
}

const TIER_COLOR_SOFT: Record<string, { bg: string; fg: string; border: string }> = {
  EX: { bg: '#eff6ff', fg: '#1e40af', border: '#dbeafe' },
  TB: { bg: '#f0fdf4', fg: '#166534', border: '#dcfce7' },
  BO: { bg: '#f7fee7', fg: '#4d7c0f', border: '#ecfccb' },
  AB: { bg: '#fefce8', fg: '#854d0e', border: '#fef9c3' },
  PA: { bg: '#fff7ed', fg: '#9a3412', border: '#ffedd5' },
  IN: { bg: '#fef2f2', fg: '#991b1b', border: '#fee2e2' },
  MA: { bg: '#fafafa', fg: '#525252', border: '#e5e5e5' },
}

const TIER_LABEL_FR: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_LABEL_EN: Record<string, string> = {
  EX: 'Excellent', TB: 'Great', BO: 'Good', AB: 'OK', PA: 'Mediocre', IN: 'Poor', MA: 'Bad',
}

const MEDAL: Record<number, { bg: string; fg: string; border: string }> = {
  1: { bg: '#fef3c7', fg: '#b45309', border: '#fcd34d' },
  2: { bg: '#f1f5f9', fg: '#475569', border: '#cbd5e1' },
  3: { bg: '#ffedd5', fg: '#9a3412', border: '#fdba74' },
}

// Median over the tier value distribution. Same logic as the community page —
// duplicated here so we don't pull a client component into a server file.
function medianTier(dist: Record<string, number>): string | null {
  const values: number[] = []
  for (const tier of TIERS) {
    const count = dist[tier] ?? 0
    const v = TIER_VALUE[tier]
    for (let i = 0; i < count; i++) values.push(v)
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  const m = values.length % 2 === 0
    ? Math.round((values[mid - 1] + values[mid]) / 2)
    : values[mid]
  return TIER_BY_VALUE[m] ?? null
}

type FeaturedEntry = {
  id: string
  title: string
  year: number | null
  cover: string | null
  score: number
  medianTier: string | null
}

type FeaturedPreview = {
  slug: string
  emoji: string
  title: string
  tierGroups: Record<string, FeaturedEntry[]>
}

// Picks the first rankable topic that has community votes. We want the home
// preview to look alive — never show a tier list with empty rows.
async function getFeaturedRankPreview(lang: string): Promise<FeaturedPreview | null> {
  const topics = await prisma.topic.findMany({
    where: { rankable: true },
    select: { slug: true, emoji: true },
    orderBy: { createdAt: 'asc' },
  })
  for (const topic of topics) {
    const data = await getCommunityData(topic.slug, lang)
    if (!data) continue
    const voted = data.entries.filter(e => e.tierCount > 0)
    if (voted.length === 0) continue
    voted.sort((a, b) => combinedScore(b) - combinedScore(a))

    const all: FeaturedEntry[] = voted.map(e => ({
      id: e.id,
      title: pickTitle(e, lang),
      year: e.year,
      cover: e.cover,
      score: combinedScore(e),
      medianTier: medianTier(e.tierDistribution),
    }))

    const groups: Record<string, FeaturedEntry[]> = {}
    for (const entry of all) {
      if (!entry.medianTier) continue
      if (!groups[entry.medianTier]) groups[entry.medianTier] = []
      groups[entry.medianTier].push(entry)
    }

    return {
      slug: topic.slug,
      emoji: topic.emoji,
      title: data.topicTitle,
      tierGroups: groups,
    }
  }
  return null
}

async function RankHomeInner({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const t = getDictionary(lang)
  const [topics, featured] = await Promise.all([
    getRankableTopics(lang),
    getFeaturedRankPreview(lang),
  ])

  const isFr = lang === 'fr'
  const tierLabels = isFr ? TIER_LABEL_FR : TIER_LABEL_EN
  const ctaTopicSlug = featured?.slug ?? topics[0]?.slug

  // The full tier-list demo shows ALL 7 mentions so the visitor sees the whole
  // system, not a sampled subset.
  const allTiers = TIERS

  return (
    <div className="page-lg" style={{ margin: '0 auto', padding: '0 24px 24px' }}>
      {/* Hero — compact, with a tier-color stripe to plant the "tier list" cue */}
      <section style={{
        position: 'relative',
        textAlign: 'center',
        padding: '32px 0 20px',
        marginBottom: 6,
      }}>
        <div aria-hidden style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent-faint) 0%, transparent 70%)',
          pointerEvents: 'none', opacity: 0.55, zIndex: 0,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 'clamp(36px, 6.4vw, 56px)',
            fontWeight: 900, letterSpacing: -1.8, lineHeight: 1.05,
            margin: '0 0 14px',
          }}>
            Culture <span style={{ color: 'var(--accent-fg)' }}>Rank</span>
          </h1>

          {/* 7-mention color stripe — tier-list cue without text */}
          <div aria-hidden style={{
            display: 'flex', width: 'min(360px, 80%)',
            margin: '0 auto 18px', height: 6, borderRadius: 4, overflow: 'hidden',
            boxShadow: '0 2px 6px rgba(0,0,0,.08)',
          }}>
            {TIERS.map(tier => (
              <span key={tier} style={{ flex: 1, background: TIER_COLOR[tier] }} />
            ))}
          </div>

          <p style={{ color: 'var(--fg-2)', fontSize: 16, maxWidth: 640, margin: '0 auto 4px', lineHeight: 1.45, fontWeight: 600 }}>
            {isFr ? 'Le tier-list maker rencontre IMDB.' : 'Where tier-list maker meets IMDB.'}
          </p>
          <p style={{ color: 'var(--fg-5)', fontSize: 13, maxWidth: 620, margin: '0 auto 18px', lineHeight: 1.5 }}>
            {isFr
              ? 'Range tes œuvres en 7 mentions, classe-les à l’intérieur, compare ton goût avec un score qui combine la mention et le rang.'
              : 'Sort your works into 7 mentions, rank them inside, and compare with a score that blends mention and rank.'}
          </p>
          {ctaTopicSlug && (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Link
                href={`/${lang}/rank/${ctaTopicSlug}`}
                style={{
                  display: 'inline-block',
                  padding: '12px 28px', borderRadius: 10,
                  background: 'var(--btn)', color: 'var(--btn-text)',
                  fontSize: 15, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 8px 22px rgba(22, 163, 74, .22)',
                  transition: 'transform .12s, box-shadow .12s',
                }}
                className="hover:[transform:translateY(-1px)]"
              >
                {isFr ? 'Commencer à classer' : 'Start ranking'}
              </Link>
              <span style={{ color: 'var(--fg-6)', fontSize: 11 }}>
                {isFr ? 'Sans compte — sauvegardé dans ton navigateur' : 'No account — saved in your browser'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Topics — single full-width row */}
      <section style={{ marginBottom: 18 }}>
        <h2 style={sectionH2}>
          <span style={sectionH2Dot} />
          {isFr ? 'Choisis ton terrain de jeu' : 'Pick your playground'}
        </h2>
        {topics.length === 0 ? (
          <p style={{ color: 'var(--fg-5)', fontSize: 13 }}>{t.rank.noRankableTopics}</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {topics.map(topic => {
              const tr = topic.translations[0]
              const title = tr?.title ?? topic.title
              return (
                <Link
                  key={topic.id}
                  href={`/${lang}/rank/${topic.slug}`}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px 12px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 11, textDecoration: 'none',
                    overflow: 'hidden',
                    transition: 'transform .12s, border-color .12s, box-shadow .12s',
                  }}
                  className="group hover:[border-color:var(--accent-muted)] hover:[transform:translateY(-1px)] hover:shadow-[0_8px_20px_rgba(0,0,0,.06)]"
                >
                  <span aria-hidden style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 4, background: 'var(--accent-fg)', opacity: 0.85,
                  }} />
                  <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{topic.emoji}</span>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span className="group-hover:text-[var(--accent-fg)]" style={{
                      fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 800,
                      color: 'var(--fg)', letterSpacing: -0.3, lineHeight: 1.2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      transition: 'color .12s',
                    }}>{title}</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-6)', marginTop: 2 }}>
                      {topic._count.entries} {topic._count.entries !== 1 ? t.rank.entries : t.rank.entry}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Tier-list demo — toutes les 7 mentions, full-width, pièce centrale */}
      {featured && (
        <section style={{ marginBottom: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 10, marginBottom: 10, flexWrap: 'wrap',
          }}>
            <h2 style={sectionH2}>
              <span style={sectionH2Dot} />
              {isFr ? 'À quoi ressemble une tier list' : 'What a tier list looks like'}
            </h2>
            <Link
              href={`/${lang}/rank/${featured.slug}`}
              style={{ fontSize: 12, color: 'var(--accent-fg)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              <span style={{ marginRight: 4 }}>{featured.emoji}</span>
              {isFr ? `Voir le classement ${featured.title.toLowerCase()} →` : `See ${featured.title.toLowerCase()} ranking →`}
            </Link>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 8,
            boxShadow: '0 8px 28px rgba(0,0,0,.06)',
          }}>
            {allTiers.map(tier => {
              const items = (featured.tierGroups[tier] ?? []).slice(0, 24)
              const totalInTier = featured.tierGroups[tier]?.length ?? 0
              const overflow = totalInTier - items.length
              const isTop = tier === 'EX'
              const c = TIER_COLOR_SOFT[tier]
              return (
                <Link
                  key={tier}
                  href={`/${lang}/rank/${featured.slug}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '76px 1fr',
                    gap: 6, alignItems: 'stretch',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{
                    background: `${TIER_COLOR[tier]}24`,
                    border: `1px solid ${TIER_COLOR[tier]}66`,
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 11,
                    color: c.fg, padding: '4px', textAlign: 'center', lineHeight: 1.1,
                  }}>
                    {tierLabels[tier]}
                  </div>
                  <div style={{
                    position: 'relative',
                    background: `${TIER_COLOR[tier]}0d`,
                    border: `1px solid ${TIER_COLOR[tier]}26`,
                    borderRadius: 6,
                    padding: '5px 8px',
                    display: 'flex', flexWrap: 'nowrap', gap: 3,
                    alignItems: 'center',
                    minHeight: 44,
                    overflow: 'hidden',
                  }}>
                    {items.length === 0 ? (
                      <span style={{
                        fontSize: 11, color: 'var(--fg-7)', fontStyle: 'italic',
                        paddingLeft: 4,
                      }}>
                        {isFr ? '— pas encore d’œuvre dans cette mention' : '— no items in this mention yet'}
                      </span>
                    ) : (
                      items.map((entry, idx) => {
                        const rank = idx + 1
                        const medal = MEDAL[rank]
                        const showMedal = isTop && rank <= 3
                        return (
                          <div key={entry.id} title={entry.title} style={{
                            position: 'relative',
                            width: 28, flexShrink: 0,
                          }}>
                            <div style={{
                              position: 'relative', width: '100%', aspectRatio: '2 / 3',
                              background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden',
                              border: '1px solid var(--border)',
                            }}>
                              {entry.cover ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={entry.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <div style={{
                                  width: '100%', height: '100%', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontFamily: "'Fraunces', serif", fontSize: 11, color: 'var(--fg-7)',
                                }}>
                                  {entry.title.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {showMedal && (
                              <span style={{
                                position: 'absolute', top: -4, left: -4,
                                width: 14, height: 14, borderRadius: 7,
                                background: medal?.bg ?? '#1a1a1a',
                                color: medal?.fg ?? '#fff',
                                border: `1.5px solid var(--bg-card)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 8,
                                boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                              }}>
                                {rank}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                    {overflow > 0 && (
                      <span style={{
                        marginLeft: 4, fontSize: 11, fontWeight: 700, color: c.fg,
                        whiteSpace: 'nowrap', flexShrink: 0,
                        background: `${TIER_COLOR[tier]}1a`,
                        padding: '2px 8px', borderRadius: 8,
                      }}>
                        +{overflow}
                      </span>
                    )}
                    {/* right-edge fade so the row doesn't end abruptly */}
                    {items.length > 0 && (
                      <span aria-hidden style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 32,
                        background: `linear-gradient(to right, transparent, ${TIER_COLOR[tier]}0d 60%)`,
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          <p style={{ margin: '10px 4px 0', fontSize: 12, color: 'var(--fg-5)', lineHeight: 1.5 }}>
            {isFr ? (
              <>
                <strong style={{ color: 'var(--fg-3)' }}>7 mentions</strong> ({TIERS.map(t => tierLabels[t]).join(' · ')}) +{' '}
                <strong style={{ color: 'var(--fg-3)' }}>rang interne</strong> (#1, #2, #3…) →{' '}
                <strong style={{ color: 'var(--accent-fg)' }}>score combiné</strong>, plus pertinent qu&apos;une note moyenne sur 5.
              </>
            ) : (
              <>
                <strong style={{ color: 'var(--fg-3)' }}>7 mentions</strong> ({TIERS.map(t => tierLabels[t]).join(' · ')}) +{' '}
                <strong style={{ color: 'var(--fg-3)' }}>internal rank</strong> (#1, #2, #3…) →{' '}
                <strong style={{ color: 'var(--accent-fg)' }}>combined score</strong>, more meaningful than a flat 5-star average.
              </>
            )}
          </p>
        </section>
      )}
    </div>
  )
}

const sectionH2: React.CSSProperties = {
  fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800,
  color: 'var(--fg)', margin: '0 0 12px', letterSpacing: -0.4,
  display: 'inline-flex', alignItems: 'center', gap: 8,
}

const sectionH2Dot: React.CSSProperties = {
  display: 'inline-block', width: 6, height: 6, borderRadius: 3,
  background: 'var(--accent-fg)', flexShrink: 0,
}

export default function RankHomePage({ params }: { params: Promise<{ lang: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <RankHomeInner params={params} />
    </Suspense>
  )
}
