import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { joinGroup } from '@/app/actions/groups'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// Landing page for group invitations. Signed-in users auto-join and get sent
// to the topic's editor with the group pre-selected. Guests see a sign-in
// prompt that preserves the invite in the redirect so they re-land here.

export default async function GroupInvitePage({
  params,
}: {
  params: Promise<{ lang: string; inviteSlug: string }>
}) {
  const { lang, inviteSlug } = await params

  const group = await prisma.group.findUnique({
    where: { inviteSlug },
    include: {
      topic: { select: { slug: true, title: true } },
      owner: { select: { name: true, username: true } },
      _count: { select: { members: true } },
    },
  })
  if (!group) notFound()

  const session = await getSession()

  if (!session) {
    // Not signed in — show the invite card with a sign-in CTA. The redirect
    // sends them back here after login so joinGroup runs automatically.
    const inviteUrl = `/${lang}/g/${inviteSlug}`
    const loginHref = `/${lang}/auth/login?redirect=${encodeURIComponent(inviteUrl)}`
    const signupHref = `/${lang}/auth/signup?redirect=${encodeURIComponent(inviteUrl)}`
    const isFr = lang === 'fr'
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', marginBottom: 10 }}>
            {isFr ? 'Invitation à un groupe' : 'Group invite'}
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 800, color: 'var(--fg)', margin: '0 0 10px', letterSpacing: -0.5 }}>
            {group.name}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-4)', lineHeight: 1.5, margin: '0 0 20px' }}>
            {isFr
              ? <>Rejoins le classement <strong>{group.topic.title}</strong> avec {group.owner.name} et {group._count.members > 1 ? `${group._count.members - 1} autre${group._count.members > 2 ? 's' : ''}` : 'tes amis'}.</>
              : <>Join the <strong>{group.topic.title}</strong> ranking with {group.owner.name}{group._count.members > 1 ? ` and ${group._count.members - 1} more` : ''}.</>}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href={loginHref} style={{ padding: '11px 16px', borderRadius: 9, background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              {isFr ? 'Me connecter pour rejoindre' : 'Sign in to join'}
            </Link>
            <Link href={signupHref} style={{ padding: '11px 16px', borderRadius: 9, background: 'var(--bg-input)', color: 'var(--fg-2)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              {isFr ? 'Créer un compte' : 'Create an account'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const result = await joinGroup(inviteSlug)
  if (!result.ok) {
    // Only non-recoverable error that can hit here is group-not-found
    // (handled above) — anything else is a real bug, bail to notFound so we
    // don't leak server state to the UI.
    notFound()
  }

  redirect(`/${lang}/rank/${group.topic.slug}/edit?group=${result.group.id}`)
}
