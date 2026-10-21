import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { RankEditClientPage } from '@/app/rank/[slug]/RankEditClientPage'
import { getCommunityData } from '@/lib/communityRankData'
import { combinedScore } from '@/lib/communityRankScore'

function getEditableTopic(slug: string) {
  return unstable_cache(
    async () => {
      return prisma.topic.findUnique({
        where: { slug },
        select: {
          id: true,
          rankable: true,
          entries: {
            select: { id: true, title: true, titleEn: true, year: true, cover: true, kind: true, genres: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    },
    [`topic-editable-v3-${slug}`],
    { tags: [`rank-${slug}`] }
  )()
}

async function RankEditInner({
  params,
}: {
  params: Promise<{ lang: string; slug: string; userName: string }>
}) {
  const { lang, slug, userName } = await params
  if (!hasLocale(lang)) notFound()

  const decodedUsername = decodeURIComponent(userName)
  const session = await getSession()
  const dict = getDictionary(lang)

  const [topic, existingList] = await Promise.all([
    getEditableTopic(slug),
    prisma.userEntryList.findFirst({
      where: { topic: { slug }, user: { username: decodedUsername }, type: { in: ['TIER', 'BOTH'] } },
      include: {
        user: { select: { id: true, name: true, username: true } },
        items: {
          include: { entry: { select: { id: true, title: true, titleEn: true, year: true, cover: true } } },
          orderBy: { position: 'asc' },
        },
      },
    }),
  ])

  if (!topic || !topic.rankable) notFound()

  // Permission gate. The /edit URL is shareable, but only the owner
  // can actually edit; everyone else sees the read-only public view.
  if (existingList) {
    if (!session || session.userId !== existingList.userId) {
      redirect(`/${lang}/rank/${slug}/${userName}`)
    }
  } else {
    // No list yet — only the matching user (logged in) can land here to create it.
    if (!session) redirect(`/${lang}/auth/login`)
    if (session.username !== decodedUsername) notFound()
  }

  const initialLists = existingList
    ? [{
        id: existingList.id,
        userId: existingList.userId,
        userName: existingList.user.name,
        username: existingList.user.username ?? existingList.userId,
        type: existingList.type as 'RANKED' | 'TIER' | 'BOTH',
        rankedTiers: existingList.rankedTiers,
        items: existingList.items.map(i => ({
          entryId: i.entryId,
          position: i.position,
          tier: i.tier,
          note: i.note,
          entry: i.entry,
        })),
      }]
    : []

  // Attach the community score + tierCount so the editor's catalog can
  // surface the best-ranked films first — matches what the guest edit
  // page already does.
  const community = await getCommunityData(slug, lang)
  const scoreById = new Map<string, { tierCount: number; score: number }>()
  if (community) {
    for (const ce of community.entries) {
      if (ce.tierCount > 0) scoreById.set(ce.id, { tierCount: ce.tierCount, score: combinedScore(ce) })
    }
  }

  const entries = topic.entries.map(e => {
    const s = scoreById.get(e.id)
    return {
      id: e.id,
      title: e.title,
      titleEn: e.titleEn,
      year: e.year,
      cover: e.cover,
      kind: (e.kind === 'SAGA' ? 'SAGA' : 'FILM') as 'FILM' | 'SAGA',
      genres: (e.genres ?? '').split(',').map(s => parseInt(s, 10)).filter(Number.isFinite),
      tierCount: s?.tierCount ?? 0,
      score: s?.score ?? 0,
    }
  })

  return (
    <RankEditClientPage
      topicSlug={slug}
      entries={entries}
      initialLists={initialLists}
      currentUserId={session!.userId}
      ownerUsername={decodedUsername}
      t={dict.rankings}
    />
  )
}

export default function RankEditPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; userName: string }>
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <RankEditInner params={params} />
    </Suspense>
  )
}
