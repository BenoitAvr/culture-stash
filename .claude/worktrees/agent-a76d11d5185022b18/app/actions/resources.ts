'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type ResourceState = { error: string } | null

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬',
  livre: '📚',
  cours: '🎓',
  podcast: '🎙️',
  album: '💿',
  film: '🎞️',
}

export async function addResource(_prev: ResourceState, formData: FormData): Promise<ResourceState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const topicSlug = formData.get('topicSlug') as string
  const lang = (formData.get('lang') as string) || 'fr'
  const title = (formData.get('title') as string)?.trim()
  const sub = (formData.get('sub') as string)?.trim()
  const type = formData.get('type') as string
  const url = (formData.get('url') as string)?.trim() || null

  if (!title || !sub || !type) return { error: 'Titre, source et type sont requis' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return { error: 'Sujet introuvable' }

  await prisma.resource.create({
    data: {
      topicId: topic.id,
      addedById: session.userId,
      title,
      sub,
      type,
      emoji: TYPE_EMOJI[type] || '📄',
      url: url || null,
    },
  })

  revalidatePath(`/fr/topics/${topicSlug}`)
  revalidatePath(`/en/topics/${topicSlug}`)
  redirect(`/${lang}/topics/${topicSlug}`)
}
