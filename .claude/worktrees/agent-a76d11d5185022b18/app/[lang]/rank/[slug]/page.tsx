import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { RankTopicPage } from '@/app/rank/[slug]/RankTopicPage'

export default async function RankSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  getDictionary(lang)
  const session = await getSession()
  const userId = session?.userId

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      translations: { where: { lang } },
      entries: {
        include: { userEntries: true },
        orderBy: { createdAt: 'asc' },
      },
      userEntryLists: {
        include: {
          user: { select: { id: true, name: true } },
          items: {
            include: { entry: { select: { id: true, title: true, year: true } } },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!topic || !topic.rankable) notFound()

  const tr = topic.translations[0]
  const title = tr?.title ?? topic.title
  const badge = tr?.badge ?? topic.badge

  const rankData: Record<string, { total: number; count: number }> = {}
  for (const list of topic.userEntryLists) {
    if (list.type !== 'RANKED') continue
    for (const item of list.items) {
      if (item.position === null) continue
      if (!rankData[item.entryId]) rankData[item.entryId] = { total: 0, count: 0 }
      rankData[item.entryId].total += item.position
      rankData[item.entryId].count += 1
    }
  }

  const entries = topic.entries.map(e => {
    const userEntry = userId ? e.userEntries.find(ue => ue.userId === userId) : null
    const rd = rankData[e.id]
    return {
      id: e.id,
      title: e.title,
      year: e.year,
      cover: e.cover,
      avgRank: rd && rd.count > 0 ? rd.total / rd.count : null,
      rankCount: rd?.count ?? 0,
      userStars: userEntry?.stars ?? null,
      userNote: userEntry?.note ?? null,
    }
  })

  const userEntryLists = topic.userEntryLists.map(l => ({
    id: l.id,
    userId: l.user.id,
    userName: l.user.name,
    type: l.type as 'RANKED' | 'TIER',
    items: l.items.map(i => ({
      entryId: i.entryId,
      position: i.position,
      tier: i.tier,
      note: i.note,
      entry: i.entry,
    })),
  }))

  return (
    <RankTopicPage
      topicSlug={slug}
      topicEmoji={topic.emoji}
      topicTitle={title}
      topicBadge={badge}
      entries={entries}
      userEntryLists={userEntryLists}
      currentUserId={userId ?? null}
      isLoggedIn={!!session}
    />
  )
}
