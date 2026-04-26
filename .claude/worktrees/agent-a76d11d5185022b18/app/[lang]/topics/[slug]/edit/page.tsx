import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { EditTopicForm } from '@/app/topics/[slug]/edit/EditTopicForm'

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: { concepts: true, related: true },
  })
  if (!topic) notFound()

  return (
    <EditTopicForm
      topic={{
        id: topic.id,
        slug: topic.slug,
        emoji: topic.emoji,
        badge: topic.badge,
        title: topic.title,
        desc: topic.desc,
        prose: topic.prose,
        diffLevel: topic.diffLevel,
        diffNote: topic.diffNote,
        rankable: topic.rankable,
        concepts: topic.concepts.map(c => c.name).join(', '),
        related: topic.related.map(r => r.name).join(', '),
      }}
    />
  )
}
