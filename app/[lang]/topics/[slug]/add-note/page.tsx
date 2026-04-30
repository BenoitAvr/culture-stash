import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { AddNoteForm } from '@/app/topics/[slug]/add-note/AddNoteForm'
import { Suspense } from 'react'

async function AddNotePageContent({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  return <AddNoteForm />
}

export default function AddNotePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <AddNotePageContent params={params} />
    </Suspense>
  )
}
