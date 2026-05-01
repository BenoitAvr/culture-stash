import type { Metadata } from 'next'
import { cache } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getDictionary, hasLocale, LOCALES } from '@/dictionaries'
import { notFound } from 'next/navigation'
import { getRankTopicHeader, getCommunityEntries } from '@/lib/communityRankData'
import { getRankHost } from '@/lib/host'
import {
  RankCommunityBody,
  CommunityListSkeleton,
  type PersonalRankData,
} from '@/app/rank/[slug]/RankTopicPage'
import type { UserEntryListData } from '@/app/rank/[slug]/UserEntryListSection'

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

const getPersonalRankData = cache(async (topicId: string): Promise<PersonalRankData> => {
  const session = await getSession()
  const userLists = session ? await getUserList(topicId, session.userId) : []

  return {
    userLists,
    currentUserId: session?.userId ?? null,
    isLoggedIn: !!session,
  }
})

export async function generateStaticParams() {
  const topics = await prisma.topic.findMany({
    where: { rankable: true },
    select: { slug: true },
  })
  return LOCALES.flatMap(lang => topics.map(t => ({ lang, slug: t.slug })))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  const header = await getRankTopicHeader(slug, lang)
  if (!header) return {}
  const isFr = lang === 'fr'
  const description = isFr
    ? `Crée ta tier list ${header.topicTitle} et compare tes goûts avec la communauté.`
    : `Create your ${header.topicTitle} tier list and compare your taste with the community.`
  return {
    metadataBase: new URL(`https://${getRankHost()}`),
    title: `${header.topicEmoji} ${isFr ? 'Classer' : 'Rank'} ${header.topicTitle}`,
    description,
    openGraph: { title: `${header.topicEmoji} ${header.topicTitle} — Tier list`, description },
    alternates: {
      canonical: `/${lang}/${slug}`,
      languages: { fr: `/fr/${slug}`, en: `/en/${slug}` },
    },
  }
}

type Dict = ReturnType<typeof getDictionary>

async function PersonalHeaderControls({
  topicId,
  topicSlug,
  lang,
  dict,
}: {
  topicId: string
  topicSlug: string
  lang: string
  dict: Dict
}) {
  const data = await getPersonalRankData(topicId)
  const myTierList = data.userLists.find(
    l => l.userId === data.currentUserId && (l.type === 'TIER' || l.type === 'BOTH')
  ) ?? null

  if (!data.isLoggedIn) {
    return (
      <Link
        href={`/${lang}/auth/login`}
        style={{
          padding: '8px 18px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'none',
          color: 'var(--fg-3)', fontSize: 13, textDecoration: 'none',
        }}
      >
        {dict.rank.loginToRate}
      </Link>
    )
  }

  return (
    <>
      <Link
        href={`/${lang}/rank/${topicSlug}/edit`}
        style={{
          padding: '8px 18px', borderRadius: 8,
          background: 'var(--btn)', color: 'var(--btn-text)',
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}
      >
        {myTierList ? dict.rankings.editList : dict.rankings.createList}
      </Link>
      {myTierList && (
        <Link
          href={`/${lang}/rank/${topicSlug}/${encodeURIComponent(myTierList.username)}`}
          title={lang === 'fr' ? 'Voir ma liste publique' : 'View my public list'}
          style={{
            width: 34, height: 34, borderRadius: 7, border: '1px solid var(--border)',
            background: 'none', color: 'var(--fg-3)', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          ↗
        </Link>
      )}
    </>
  )
}

function CommunityBody({
  topicId,
  topicSlug,
  slug,
  lang,
}: {
  topicId: string
  topicSlug: string
  slug: string
  lang: string
}) {
  const entriesPromise = getCommunityEntries(slug, lang)
  const personalDataPromise = getPersonalRankData(topicId)

  return (
    <RankCommunityBody
      topicSlug={topicSlug}
      entriesPromise={entriesPromise}
      personalDataPromise={personalDataPromise}
    />
  )
}

export default async function RankSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const header = await getRankTopicHeader(slug, lang)
  if (!header) notFound()

  const dict = getDictionary(lang)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 60px' }}>

      {/* Header — fully static for known slugs (generateStaticParams), with personal controls suspended */}
      <div style={{ padding: '20px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href={`/${lang}/rank`} style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>
              {lang === 'fr' ? 'Classer' : 'Rank'}
            </Link>
            <span style={{ color: 'var(--fg-9)' }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--fg-3)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 9px' }}>
              {header.topicBadge}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Suspense fallback={<div style={{ width: 120, height: 36, borderRadius: 8, background: 'var(--bg-subtle)' }} />}>
              <PersonalHeaderControls topicId={header.topicId} topicSlug={slug} lang={lang} dict={dict} />
            </Suspense>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{header.topicEmoji}</span>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: 'var(--fg)', letterSpacing: -0.3, lineHeight: 1.1 }}>
              {dict.rank.communityTitle.replace('{topic}', header.topicTitle.toLowerCase())}
            </h1>
            <div style={{ fontSize: 12, color: 'var(--fg-5)', marginTop: 2, fontWeight: 300 }}>
              {lang === 'fr' ? 'Classement collectif · mis à jour en continu' : 'Collective ranking · updated continuously'}
            </div>
          </div>
        </div>
      </div>

      {/* Community body — suspended (creates personalDataPromise inside) */}
      <div style={{ paddingTop: 10 }}>
        <Suspense fallback={<CommunityListSkeleton />}>
          <CommunityBody
            topicId={header.topicId}
            topicSlug={slug}
            slug={slug}
            lang={lang}
          />
        </Suspense>
      </div>
    </div>
  )
}
