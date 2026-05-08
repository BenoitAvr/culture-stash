'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { UserEntryListSection, type UserEntryListData } from './UserEntryListSection'
import type { Dict } from '@/dictionaries/client'

type EntryItem = { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null }

export function RankEditClientPage({
  topicSlug,
  entries,
  initialLists,
  currentUserId,
  ownerUsername,
  t,
}: {
  topicSlug: string
  entries: EntryItem[]
  initialLists: UserEntryListData[]
  currentUserId: string | null
  ownerUsername: string | null
  t: Dict['rankings']
}) {
  const router = useRouter()
  const { lang } = useParams() as { lang: string }
  const [lists, setLists] = useState<UserEntryListData[]>(initialLists)

  function handleSetIsEditing(v: boolean) {
    if (v) return
    // Logged-in users land on their shareable public URL after closing.
    // Guests have no public list yet — bring them back to the community page.
    const target = ownerUsername
      ? `/${lang}/rank/${topicSlug}/${encodeURIComponent(ownerUsername)}`
      : `/${lang}/rank/${topicSlug}`
    router.push(target)
  }

  return (
    <div className="rank-edit-shell page-lg" style={{ margin: '0 auto', padding: '24px 24px 60px' }}>
      <UserEntryListSection
        topicSlug={topicSlug}
        entries={entries}
        lists={lists}
        onListsChange={setLists}
        currentUserId={currentUserId}
        isEditing={true}
        setIsEditing={handleSetIsEditing}
        t={t}
      />
    </div>
  )
}
