import { getSession } from '@/lib/session'
import { hasLocale } from '@/dictionaries'
import { notFound, redirect } from 'next/navigation'

// Backwards-compat redirect: the editor now lives under
// /rank/[slug]/[userName]/edit so the URL is shareable. Resolve the
// current session's username and redirect there.
export default async function RankEditRedirect({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()

  const session = await getSession()
  if (!session) redirect(`/${lang}/auth/login`)

  redirect(`/${lang}/rank/${slug}/${encodeURIComponent(session.username)}/edit`)
}
