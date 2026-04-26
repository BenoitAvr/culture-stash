'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type TopicTranslationInput = {
  badge: string
  title: string
  desc: string
  prose: string
  diffNote: string
}

export async function saveTopicTranslation(
  slug: string,
  lang: string,
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await getSession()
  if (!session) return { error: 'Non connecté' }

  const topic = await prisma.topic.findUnique({ where: { slug } })
  if (!topic) return { error: 'Topic introuvable' }

  const data: TopicTranslationInput = {
    badge: formData.get('badge') as string,
    title: formData.get('title') as string,
    desc: formData.get('desc') as string,
    prose: formData.get('prose') as string,
    diffNote: formData.get('diffNote') as string,
  }

  if (!data.badge || !data.title || !data.desc) return { error: 'Badge, titre et description requis' }

  await prisma.topicTranslation.upsert({
    where: { topicId_lang: { topicId: topic.id, lang } },
    update: data,
    create: { topicId: topic.id, lang, ...data },
  })

  revalidatePath(`/${lang}/topics/${slug}`)
  return null
}
