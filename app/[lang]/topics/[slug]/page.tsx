import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { TopicTabs } from '@/app/topics/[slug]/TopicTabs'
import Link from 'next/link'
import { Suspense } from 'react'

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: { translations: { where: { lang } } },
  })
  if (!topic) return {}
  const tr = topic.translations[0]
  const title = tr?.title ?? topic.title
  const desc = tr?.desc ?? topic.desc
  return {
    title: `${topic.emoji} ${title}`,
    description: desc.slice(0, 160),
    openGraph: { title: `${topic.emoji} ${title}`, description: desc.slice(0, 160) },
    alternates: {
      canonical: `/${lang}/topics/${slug}`,
      languages: { fr: `/fr/topics/${slug}`, en: `/en/topics/${slug}` },
    },
  }
}

async function TopicPageContent({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const t = getDictionary(lang)
  const session = await getSession()
  const userId = session?.userId

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      concepts: true,
      related: true,
      translations: { where: { lang } },
      parent: { include: { translations: { where: { lang } } } },
      children: {
        include: { translations: { where: { lang } } },
        orderBy: { title: 'asc' },
      },
      resources: {
        include: {
          translations: { where: { lang } },
        },
      },
      notes: {
        include: {
          author: { select: { name: true } },
          tags: true,
          likes: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      userLists: {
        include: {
          user: { select: { id: true, name: true } },
          items: {
            include: { resource: { select: { id: true, title: true, emoji: true, type: true } } },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!topic) notFound()

  const personalNote = userId
    ? await prisma.userTopicNote.findUnique({
        where: { userId_topicId: { userId, topicId: topic.id } },
      })
    : null

  const tr = topic.translations[0]

  const resources = topic.resources.map(r => {
    const rtr = r.translations[0]
    return {
      id: r.id,
      title: rtr?.title ?? r.title,
      sub: rtr?.sub ?? r.sub,
      type: r.type,
      emoji: r.emoji,
      url: r.url,
    }
  })

  const notes = topic.notes.map(n => ({
    id: n.id,
    title: n.title,
    excerpt: n.excerpt,
    createdAt: n.createdAt.toISOString(),
    likeCount: n.likes.length,
    userHasLiked: userId ? n.likes.some(l => l.userId === userId) : false,
    author: n.author,
    tags: n.tags,
  }))

  const userLists = topic.userLists.map(l => ({
    id: l.id,
    userId: l.user.id,
    userName: l.user.name,
    type: l.type as 'RANKED' | 'TIER',
    rankedTiers: l.rankedTiers,
    items: l.items.map(i => ({
      resourceId: i.resourceId,
      position: i.position,
      tier: i.tier,
      note: i.note,
      resource: i.resource,
    })),
  }))

  if (lang !== 'fr' && !tr) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <span style={{ fontSize: 48 }}>{topic.emoji}</span>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: 'var(--fg)', margin: '24px 0 12px' }}>
          {lang === 'en' ? 'Not available in English yet' : 'Pas encore disponible dans cette langue'}
        </h1>
        <p style={{ color: 'var(--fg-6)', fontSize: 14, lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
          {lang === 'en'
            ? 'This topic exists in French only. You can read it in French or help by adding an English translation.'
            : 'Ce sujet existe uniquement en français. Vous pouvez le lire en français ou aider en ajoutant une traduction.'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={`/fr/topics/${slug}`} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--fg-3)', fontSize: 14, textDecoration: 'none' }}>
            {lang === 'en' ? 'Read in French' : 'Lire en français'} →
          </Link>
          {session && (
            <Link href={`/${lang}/topics/${slug}/translate`} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              {lang === 'en' ? '+ Add English translation' : '+ Ajouter une traduction'}
            </Link>
          )}
        </div>
      </div>
    )
  }

  const badge = tr?.badge ?? topic.badge
  const title = tr?.title ?? topic.title
  const desc = tr?.desc ?? topic.desc
  const prose = tr?.prose ?? topic.prose
  const diffNote = tr?.diffNote ?? topic.diffNote

  const parentTitle = topic.parent?.translations[0]?.title ?? topic.parent?.title
  const children = topic.children.map(c => ({
    slug: c.slug,
    emoji: c.emoji,
    title: c.translations[0]?.title ?? c.title,
    desc: c.translations[0]?.desc ?? c.desc,
  }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--border)' }}>

        {/* Breadcrumb + actions */}
        {(topic.parent || session) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            {topic.parent ? (
              <Link href={`/${lang}/topics/${topic.parent.slug}`} style={{ fontSize: 12, color: 'var(--fg-7)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                ← {topic.parent.emoji} {parentTitle}
              </Link>
            ) : <span />}
            {session && (
              <Link href={`/${lang}/topics/${slug}/edit`} style={{ fontSize: 12, color: 'var(--fg-8)', textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
                Modifier
              </Link>
            )}
          </div>
        )}

        {/* Titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, boxShadow: 'var(--shadow)' }}>
            {topic.emoji}
          </div>
          <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', background: 'var(--accent-faint)', border: '1px solid var(--accent-muted)', padding: '3px 10px', borderRadius: 20, color: 'var(--accent-fg)', fontWeight: 500 }}>
            {badge}
          </span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, marginBottom: 12, color: 'var(--fg)' }}>
          {title}
        </h1>

        {/* Description */}
        <p style={{ color: 'var(--fg-3)', maxWidth: 580, lineHeight: 1.6, margin: 0 }}>{desc}</p>

        {/* Sous-sujets */}
        {(children.length > 0 || session) && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                Sous-sujets
              </p>
              {session && (
                <Link href={`/${lang}/topics/new?parent=${topic.id}`} style={{ fontSize: 11, color: 'var(--fg-7)', textDecoration: 'none', border: '1px dashed var(--border)', borderRadius: 5, padding: '2px 8px' }}>
                  + Ajouter
                </Link>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {children.map(c => (
                <Link key={c.slug} href={`/${lang}/topics/${c.slug}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)' }}>
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{c.title}</div>
                    {c.desc && <div style={{ fontSize: 11, color: 'var(--fg-7)', marginTop: 1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.desc}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <TopicTabs
        lang={lang}
        prose={prose}
        diffLevel={topic.diffLevel}
        diffNote={diffNote}
        concepts={topic.concepts}
        related={topic.related}
        resources={resources}
        notes={notes}
        userLists={userLists}
        currentUserId={userId ?? null}
        slug={slug}
        isLoggedIn={!!session}
        rankable={topic.rankable}
        personalNoteContent={personalNote?.content ?? null}
      />
    </div>
  )
}

export default function TopicPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <TopicPageContent params={params} />
    </Suspense>
  )
}
