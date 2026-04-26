import { prisma } from '@/lib/prisma'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function RankHomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const t = getDictionary(lang)

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
          Tot<span style={{ color: '#c8f55a' }}>an</span>tia
        </h1>
        <p style={{ color: '#aaa', fontSize: 16, maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
          {t.rank.tagline}
        </p>
      </div>

      {topics.length === 0 ? (
        <p style={{ color: '#555', textAlign: 'center', fontSize: 14 }}>{t.rank.noRankableTopics}</p>
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
                style={{ display: 'block', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 20, textDecoration: 'none' }}
                className="group hover:[border-color:#3a3a3a] hover:[-webkit-transform:translateY(-2px)] hover:[transform:translateY(-2px)]"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 40 }}>{topic.emoji}</span>
                  <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', background: '#242424', border: '1px solid #2a2a2a', padding: '3px 10px', borderRadius: 20, color: '#777' }}>
                    {badge}
                  </span>
                </div>
                <h2 className="group-hover:text-[#c8f55a]" style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: '#f0f0f0', marginBottom: 12, letterSpacing: -0.5, transition: 'color .2s' }}>
                  {title}
                </h2>
                <div style={{ fontSize: 12, color: '#555' }}>
                  {topic._count.entries} {topic._count.entries !== 1 ? t.rank.entries : t.rank.entry}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  )
}
