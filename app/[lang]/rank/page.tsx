import { prisma } from '@/lib/prisma'
import { getDictionary, hasLocale } from '@/dictionaries'
import { getSession } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function RankHomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const t = getDictionary(lang)
  const session = await getSession()

  const topics = await prisma.topic.findMany({
    where: { rankable: true },
    include: {
      _count: { select: { entries: true } },
      translations: { where: { lang } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', padding: '64px 0 48px' }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 64, fontWeight: 900, letterSpacing: -2, marginBottom: 16, lineHeight: 1.05 }}>
          Tot<span style={{ color: 'var(--accent-fg)' }}>an</span>tia
        </h1>
        <p style={{ color: 'var(--fg-3)', fontSize: 16, maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
          {t.rank.tagline}
        </p>
      </div>

      {topics.length === 0 ? (
        <p style={{ color: 'var(--fg-7)', textAlign: 'center', fontSize: 14 }}>{t.rank.noRankableTopics}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {topics.map(topic => {
            const tr = topic.translations[0]
            const title = tr?.title ?? topic.title
            const badge = tr?.badge ?? topic.badge
            return (
              <Link
                key={topic.id}
                href={`/${lang}/rank/${topic.slug}`}
                style={{ display: 'block', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 20, textDecoration: 'none' }}
                className="group hover:[border-color:#3a3a3a] hover:[-webkit-transform:translateY(-2px)] hover:[transform:translateY(-2px)]"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 40 }}>{topic.emoji}</span>
                  <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 20, color: 'var(--fg-6)' }}>
                    {badge}
                  </span>
                </div>
                <h2 className="group-hover:text-[var(--accent-fg)]" style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: 'var(--fg)', marginBottom: 12, letterSpacing: -0.5, transition: 'color .2s' }}>
                  {title}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--fg-7)' }}>
                  {topic._count.entries} {topic._count.entries !== 1 ? t.rank.entries : t.rank.entry}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {session && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <Link href={`/${lang}/topics/new?rankable=true`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 9, border: '1px dashed var(--border)', color: 'var(--fg-6)', fontSize: 13, textDecoration: 'none' }}>
            + Nouveau thème
          </Link>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  )
}
