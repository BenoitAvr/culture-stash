import { prisma } from '@/lib/prisma'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const t = getDictionary(lang)
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const TYPE_COLOR: Record<string, string> = {
    video: '#7c6df0', livre: '#f5a623', cours: '#c8f55a',
    podcast: '#f57c7c', album: '#7c6df0', film: '#7c6df0',
  }

  if (!query) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--fg-6)' }}>{t.search.enter}</p>
      </div>
    )
  }

  const [topics, resources] = await Promise.all([
    prisma.topic.findMany({
      where: { OR: [{ title: { contains: query } }, { desc: { contains: query } }] },
      include: { translations: { where: { lang } } },
      take: 10,
    }),
    prisma.resource.findMany({
      where: { OR: [{ title: { contains: query } }, { sub: { contains: query } }] },
      include: {
        topic: { select: { slug: true, title: true } },
        translations: { where: { lang } },
      },
      take: 10,
    }),
  ])

  const total = topics.length + resources.length

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <p style={{ color: 'var(--fg-6)', fontSize: 13, marginBottom: 32 }}>
        {total} {total !== 1 ? t.search.results : t.search.result} {t.search.for}{' '}
        <span style={{ color: 'var(--fg)' }}>&ldquo;{query}&rdquo;</span>
      </p>

      {topics.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', marginBottom: 14 }}>{t.search.topics}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topics.map(topic => {
              const tr = topic.translations[0]
              return (
                <Link key={topic.id} href={`/${lang}/topics/${topic.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '14px 18px' }}>
                    <span style={{ fontSize: 26 }}>{topic.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--fg)', marginBottom: 2 }}>{tr?.title ?? topic.title}</div>
                      <div style={{ color: 'var(--fg-6)', fontSize: 12 }}>{tr?.desc ?? topic.desc}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {resources.length > 0 && (
        <section>
          <h2 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', marginBottom: 14 }}>{t.search.resources}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resources.map(r => {
              const color = TYPE_COLOR[r.type] || '#7c6df0'
              const tr = r.translations[0]
              return (
                <Link key={r.id} href={`/${lang}/topics/${r.topic.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '14px 18px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: `${color}22`, flexShrink: 0 }}>
                      {r.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--fg)', marginBottom: 2 }}>
                        {tr?.title ?? r.title}
                        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 7px', borderRadius: 4, marginLeft: 7, background: `${color}22`, color }}>{r.type}</span>
                      </div>
                      <div style={{ color: 'var(--fg-6)', fontSize: 12 }}>{tr?.sub ?? r.sub}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-7)' }}>{t.search.in} <span style={{ color: 'var(--fg-6)' }}>{r.topic.title}</span></div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {total === 0 && (
        <p style={{ color: 'var(--fg-6)', padding: '40px 0', textAlign: 'center' }}>{t.search.noResults}</p>
      )}
    </div>
  )
}
