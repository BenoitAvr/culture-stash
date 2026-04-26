import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'
import { AddResourceForm } from '@/app/topics/[slug]/add-resource/AddResourceForm'

export default async function AddResourcePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  return <AddResourceForm />
}
