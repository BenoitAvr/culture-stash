import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { AddResourceForm } from '@/app/topics/[slug]/add-resource/AddResourceForm'
import { Suspense } from 'react'

async function AddResourcePageContent({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  return <AddResourceForm />
}

export default function AddResourcePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <AddResourcePageContent params={params} />
    </Suspense>
  )
}
