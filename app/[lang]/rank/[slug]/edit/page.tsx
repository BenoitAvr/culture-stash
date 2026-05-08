import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { RankEditClientPage } from '@/app/rank/[slug]/RankEditClientPage'

// Logged-in users get redirected to /[userName]/edit so the URL is shareable.
// Guests render the editor in-place — their list lives in localStorage until
// they sign in, then MergeAfterLogin uploads it.

function getEditableTopic(slug: string) {
  return unstable_cache(
    async () => {
      return prisma.topic.findUnique({
        where: { slug },
        select: {
          id: true,
          rankable: true,
          entries: {
            select: { id: true, title: true, titleEn: true, year: true, cover: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    },
    [`topic-editable-v2-${slug}`],
    { tags: [`rank-${slug}`] }
  )()
}

async function GuestRankEditInner({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (session) {
    redirect(`/${lang}/rank/${slug}/${encodeURIComponent(session.username)}/edit`)
  }

  const topic = await getEditableTopic(slug)
  if (!topic || !topic.rankable) notFound()

  const dict = getDictionary(lang)
  const entries = topic.entries.map(e => ({
    id: e.id,
    title: e.title,
    titleEn: e.titleEn,
    year: e.year,
    cover: e.cover,
  }))

  return (
    <RankEditClientPage
      topicSlug={slug}
      entries={entries}
      initialLists={[]}
      currentUserId={null}
      ownerUsername={null}
      t={dict.rankings}
    />
  )
}

export default function RankEditPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <GuestRankEditInner params={params} />
    </Suspense>
  )
}
