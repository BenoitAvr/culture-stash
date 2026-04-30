import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { getCommunityData } from '@/lib/communityRankData'
import { RankTopicPage, type PersonalRankData } from '@/app/rank/[slug]/RankTopicPage'
import type { UserEntryListData } from '@/app/rank/[slug]/UserEntryListSection'
import type { RankEntry } from '@/lib/communityRankData'

const INITIAL_COUNT = 100

function combinedScore(e: RankEntry) {
  return (e.avgTierScore ?? 0) * 4 + (e.avgRank ? 1 / e.avgRank * 8 : 0) + e.favoriteCount + e.tierCount * 0.2
}

async function getUserList(topicId: string, userId: string): Promise<UserEntryListData[]> {
  const lists = await prisma.userEntryList.findMany({
    where: { topicId, userId, NOT: { type: 'BOTH' } },
    include: {
      user: { select: { id: true, name: true, username: true } },
      items: {
        include: { entry: { select: { id: true, title: true, year: true, cover: true } } },
        orderBy: { position: 'asc' },
      },
    },
  })
  return lists.map(l => ({
    id: l.id,
    userId: l.user.id,
    userName: l.user.name,
    username: l.user.username ?? l.user.id,
    type: l.type as 'RANKED' | 'TIER' | 'BOTH',
    rankedTiers: l.rankedTiers,
    items: l.items.map(i => ({
      entryId: i.entryId,
      position: i.position,
      tier: i.tier,
      note: i.note,
      entry: i.entry,
    })),
  }))
}

async function getPersonalRankData(topicId: string): Promise<PersonalRankData> {
  const session = await getSession()
  const userLists = session ? await getUserList(topicId, session.userId) : []

  return {
    userLists,
    currentUserId: session?.userId ?? null,
    isLoggedIn: !!session,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  const data = await getCommunityData(slug, lang)
  if (!data) return {}
  const isFr = lang === 'fr'
  const description = isFr
    ? `Crée ta tier list ${data.topicTitle} et compare tes goûts avec la communauté.`
    : `Create your ${data.topicTitle} tier list and compare your taste with the community.`
  return {
    title: `${data.topicEmoji} ${isFr ? 'Classer' : 'Rank'} ${data.topicTitle}`,
    description,
    openGraph: { title: `${data.topicEmoji} ${data.topicTitle} — Tier list`, description },
    alternates: {
      canonical: `/${lang}/rank/${slug}`,
      languages: { fr: `/fr/rank/${slug}`, en: `/en/rank/${slug}` },
    },
  }
}

async function RankSlugInner({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()
  getDictionary(lang)

  const data = await getCommunityData(slug, lang)
  if (!data) notFound()

  const sortedEntries = [...data.entries].sort((a, b) => combinedScore(b) - combinedScore(a))
  const initialEntries = sortedEntries.slice(0, INITIAL_COUNT)
  const totalEntries = sortedEntries.length

  const personalDataPromise = getPersonalRankData(data.topicId)

  return (
    <RankTopicPage
      topicSlug={slug}
      topicEmoji={data.topicEmoji}
      topicTitle={data.topicTitle}
      topicBadge={data.topicBadge}
      initialEntries={initialEntries}
      totalEntries={totalEntries}
      personalDataPromise={personalDataPromise}
    />
  )
}

export default function RankSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  return <RankSlugInner params={params} />
}
