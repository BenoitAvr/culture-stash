import { redirect, notFound } from 'next/navigation'
import { hasLocale } from '@/dictionaries'
import { prisma } from '@/lib/prisma'

// The /rank/ landing used to be its own hero + Top 10 + how-it-works page.
// We retired that in favour of putting the ranking itself at the top of the
// funnel, with topic tabs that double as the entry points. Hitting /rank/
// sends you to the default rankable topic (films, until others come online).
export default async function RankHomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const defaultTopic = await prisma.topic.findFirst({
    where: { rankable: true },
    orderBy: { createdAt: 'asc' },
    select: { slug: true },
  })
  if (!defaultTopic) notFound()
  redirect(`/${lang}/rank/${defaultTopic.slug}`)
}
