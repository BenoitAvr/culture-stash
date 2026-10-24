'use client'

import { use } from 'react'
import Link from 'next/link'
import type { PersonalRankData } from './RankTopicPage'

// Single primary CTA for the ranking page. Text + destination swap based on
// whether the visitor already has a tier list for this topic — same green
// visual either way so the "where do I click" answer never moves.
export function StartTierListCTA({
  lang,
  topicSlug,
  personalDataPromise,
}: {
  lang: string
  topicSlug: string
  personalDataPromise: Promise<PersonalRankData>
}) {
  const data = use(personalDataPromise)
  const myList = data.userLists.find(
    l => l.userId === data.currentUserId && (l.type === 'TIER' || l.type === 'BOTH')
  )
  const isFr = lang === 'fr'

  const label = myList
    ? (isFr ? 'Ma liste' : 'My list')
    : (isFr ? 'Faire ma tier list' : 'Make my tier list')
  const href = myList
    ? `/${lang}/rank/${topicSlug}/${encodeURIComponent(myList.username)}/edit`
    : `/${lang}/rank/${topicSlug}/edit`

  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '13px 22px',
        borderRadius: 12,
        background: 'var(--accent-fg)',
        color: '#fff',
        fontSize: 15, fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 6px 16px rgba(22,163,74,.22)',
      }}
    >
      {myList ? <span aria-hidden>✏️</span> : null}
      {label}
      <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>→</span>
    </Link>
  )
}
