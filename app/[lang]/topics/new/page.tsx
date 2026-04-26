import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { NewTopicForm } from '@/app/topics/new/NewTopicForm'
import { prisma } from '@/lib/prisma'

export default async function NewTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ parent?: string; rankable?: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  const { parent: parentId, rankable } = await searchParams

  const topics = await prisma.topic.findMany({
    select: { id: true, slug: true, emoji: true, title: true, translations: { where: { lang }, select: { title: true } } },
    orderBy: { title: 'asc' },
  })

  const topicOptions = topics.map(t => ({
    id: t.id,
    slug: t.slug,
    emoji: t.emoji,
    title: t.translations[0]?.title ?? t.title,
  }))

  return (
    <div>
      <NewTopicForm topics={topicOptions} defaultParentId={parentId ?? null} defaultRankable={rankable === 'true'} />
    </div>
  )
}
