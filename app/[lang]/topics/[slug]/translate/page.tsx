import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { TranslateTopicForm } from '@/app/topics/[slug]/TranslateTopicForm'
import { Suspense } from 'react'

async function TranslatePageContent({
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
    include: { translations: { where: { lang } } },
  })
  if (!topic) notFound()

  return (
    <TranslateTopicForm
      defaultBadge={topic.badge}
      defaultTitle={topic.title}
      defaultDesc={topic.desc}
      defaultProse={topic.prose}
      defaultDiffNote={topic.diffNote}
    />
  )
}

export default function TranslatePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <TranslatePageContent params={params} />
    </Suspense>
  )
}
