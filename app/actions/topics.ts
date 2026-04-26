'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type TopicState = { error: string } | null

export async function createTopic(_prev: TopicState, formData: FormData): Promise<TopicState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const title = (formData.get('title') as string)?.trim()
  const emoji = (formData.get('emoji') as string)?.trim()
  const badge = (formData.get('badge') as string)?.trim()
  const desc = (formData.get('desc') as string)?.trim()
  const prose = (formData.get('prose') as string)?.trim()
  const diffLevel = parseInt(formData.get('diffLevel') as string) || 3
  const diffNote = (formData.get('diffNote') as string)?.trim()
  const conceptsRaw = (formData.get('concepts') as string) || ''
  const relatedRaw = (formData.get('related') as string) || ''
  const rankable = formData.get('rankable') === 'on'
  const parentId = (formData.get('parentId') as string) || null

  if (!title) return { error: 'Titre requis' }

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) return { error: 'Un sujet avec ce titre existe déjà' }

  const topic = await prisma.topic.create({
    data: {
      slug,
      title,
      emoji: emoji || '📋',
      badge: badge || 'Général',
      desc: desc || '',
      prose: prose || '',
      diffLevel,
      diffNote: diffNote || '',
      rankable,
      parentId,
      concepts: {
        create: conceptsRaw.split(',').map(n => ({ name: n.trim() })).filter(c => c.name),
      },
      related: {
        create: relatedRaw.split(',').map(n => ({ name: n.trim() })).filter(r => r.name),
      },
    },
  })

  revalidatePath('/')
  redirect(rankable ? `/fr/rank/${topic.slug}` : `/fr/topics/${topic.slug}`)
}

export async function updateTopic(_prev: TopicState, formData: FormData): Promise<TopicState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const topicId = formData.get('topicId') as string
  const lang = (formData.get('lang') as string) || 'fr'
  const emoji = (formData.get('emoji') as string)?.trim()
  const badge = (formData.get('badge') as string)?.trim()
  const title = (formData.get('title') as string)?.trim()
  const desc = (formData.get('desc') as string)?.trim()
  const prose = (formData.get('prose') as string)?.trim()
  const diffLevel = parseInt(formData.get('diffLevel') as string) || 3
  const diffNote = (formData.get('diffNote') as string)?.trim()
  const conceptsRaw = (formData.get('concepts') as string) || ''
  const relatedRaw = (formData.get('related') as string) || ''
  const rankable = formData.get('rankable') === 'on'

  if (!title || !emoji || !badge || !desc) return { error: 'Titre, emoji, catégorie et description sont requis' }

  const topic = await prisma.topic.findUnique({ where: { id: topicId } })
  if (!topic) return { error: 'Sujet introuvable' }

  await prisma.concept.deleteMany({ where: { topicId } })
  await prisma.related.deleteMany({ where: { topicId } })

  await prisma.topic.update({
    where: { id: topicId },
    data: {
      emoji,
      badge,
      title,
      desc,
      prose: prose || '',
      diffLevel,
      diffNote: diffNote || '',
      rankable,
      concepts: {
        create: conceptsRaw.split(',').map(n => ({ name: n.trim() })).filter(c => c.name),
      },
      related: {
        create: relatedRaw.split(',').map(n => ({ name: n.trim() })).filter(r => r.name),
      },
    },
  })

  revalidatePath(`/fr/topics/${topic.slug}`)
  revalidatePath(`/en/topics/${topic.slug}`)
  revalidatePath('/')
  redirect(`/${lang}/topics/${topic.slug}`)
}
