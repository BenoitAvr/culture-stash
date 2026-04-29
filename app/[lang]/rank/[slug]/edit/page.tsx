import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { RankEditClientPage } from '@/app/rank/[slug]/RankEditClientPage'

export default async function RankEditPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  const dict = getDictionary(lang)

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      translations: { where: { lang } },
      entries: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!topic || !topic.rankable) notFound()

  const existingList = await prisma.userEntryList.findFirst({
    where: { topicId: topic.id, userId: session.userId, type: { in: ['TIER', 'BOTH'] } },
    include: {
      user: { select: { id: true, name: true, username: true } },
      items: {
        include: { entry: { select: { id: true, title: true, year: true, cover: true } } },
        orderBy: { position: 'asc' },
      },
    },
  })

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

  const entries = topic.entries.map(e => ({
    id: e.id,
    title: e.title,
    year: e.year,
  }))

  return (
    <RankEditClientPage
      topicSlug={slug}
      entries={entries}
      initialLists={initialLists}
      currentUserId={session.userId}
      t={dict.rankings}
    />
  )
}
