import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const t = getDictionary(lang)
  const session = await getSession()

  const topics = await prisma.topic.findMany({
    include: {
      _count: { select: { resources: true, notes: true } },
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
          {t.home.tagline}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {topics.map(topic => {
          const tr = topic.translations[0]
          const needsTranslation = lang !== 'fr' && !tr
          const title = needsTranslation ? null : (tr?.title ?? topic.title)
          const desc = needsTranslation ? null : (tr?.desc ?? topic.desc)
          const cardHref = needsTranslation
            ? (session ? `/${lang}/topics/${topic.slug}/translate` : `/fr/topics/${topic.slug}`)
            : `/${lang}/topics/${topic.slug}`
          return (
            <div key={topic.id} style={{ position: 'relative' }}>
              <Link
                href={cardHref}
                style={{ display: 'block', background: '#161616', border: `1px solid ${needsTranslation ? '#2a2a1a' : '#2a2a2a'}`, borderRadius: 12, padding: 20, textDecoration: 'none', opacity: needsTranslation ? 0.6 : 1 }}
                className="group hover:[border-color:#3a3a3a] hover:[-webkit-transform:translateY(-2px)] hover:[transform:translateY(-2px)]"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 40 }}>{topic.emoji}</span>
                  {needsTranslation ? (
                    <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', background: '#1a1a10', border: '1px solid #3a3a20', padding: '3px 10px', borderRadius: 20, color: '#666' }}>
                      {lang === 'en' ? 'not translated' : 'non traduit'}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', background: '#242424', border: '1px solid #2a2a2a', padding: '3px 10px', borderRadius: 20, color: '#777' }}>
                      {topic.badge}
                    </span>
                  )}
                </div>
                {needsTranslation ? (
                  <div style={{ height: 80, display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#444', fontStyle: 'italic' }}>
                      {lang === 'en' ? 'No English translation yet' : 'Pas encore de traduction'}
                    </span>
                  </div>
                ) : (
                  <>
                    <h2 className="group-hover:text-[#c8f55a]" style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: '#f0f0f0', marginBottom: 6, letterSpacing: -0.5, transition: 'color .2s' }}>
                      {title}
                    </h2>
                    <p style={{ color: '#777', fontSize: 13, lineHeight: 1.6, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {desc}
                    </p>
                  </>
                )}
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
                  <span>{topic._count.resources} {t.home.resource}{topic._count.resources !== 1 ? 's' : ''}</span>
                  <span>{topic._count.notes} {t.home.note}{topic._count.notes !== 1 ? 's' : ''}</span>
                </div>
              </Link>
              {needsTranslation && session && (
                <Link
                  href={`/${lang}/topics/${topic.slug}/translate`}
                  style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: '#c8f55a', textDecoration: 'none', border: '1px solid #3a4a20', borderRadius: 6, padding: '3px 8px', background: '#1a2010' }}
                >
                  + Translate
                </Link>
              )}
            </div>
          )
        })}

        <Link
          href={`/${lang}/topics/new`}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'transparent', border: '1px dashed #2a2a2a', borderRadius: 12, padding: 20, textDecoration: 'none', color: '#555', minHeight: 180, transition: 'border-color .2s, color .2s' }}
          className="hover:[border-color:#c8f55a] hover:text-[#c8f55a]"
        >
          <span style={{ fontSize: 32, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{t.home.createTopic}</span>
        </Link>
      </div>
      <div style={{ height: 80 }} />
    </div>
  )
}
