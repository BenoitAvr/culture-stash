'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type NoteState = { error: string } | null

export async function createNote(_prev: NoteState, formData: FormData): Promise<NoteState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const topicSlug = formData.get('topicSlug') as string
  const lang = (formData.get('lang') as string) || 'fr'
  const title = (formData.get('title') as string)?.trim()
  const content = (formData.get('content') as string)?.trim()
  const tagsRaw = (formData.get('tags') as string) || ''

  if (!title || !content) return { error: 'Titre et contenu requis' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return { error: 'Sujet introuvable' }

  const excerpt = content.length > 240 ? content.slice(0, 240).trimEnd() + '...' : content

  await prisma.note.create({
    data: {
      topicId: topic.id,
      authorId: session.userId,
      title,
      excerpt,
      content,
      tags: {
        create: tagsRaw
          .split(',')
          .map(n => ({ name: n.trim() }))
          .filter(t => t.name),
      },
    },
  })

  revalidatePath(`/fr/topics/${topicSlug}`)
  revalidatePath(`/en/topics/${topicSlug}`)
  redirect(`/${lang}/topics/${topicSlug}`)
}
