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
  currentUserId: string
  ownerUsername?: string
  t: Dict['rankings']
}) {
  const router = useRouter()
  const { lang } = useParams() as { lang: string }
  const [lists, setLists] = useState<UserEntryListData[]>(initialLists)

  function handleSetIsEditing(v: boolean) {
    if (!v) {
      // Once edits are saved, send the user to their public list view —
      // that's the URL they'd want to share.
      const target = ownerUsername
        ? `/${lang}/rank/${topicSlug}/${encodeURIComponent(ownerUsername)}`
        : `/${lang}/rank/${topicSlug}`
      router.push(target)
    }
  }

  return (
    <div className="rank-edit-shell" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 60px' }}>
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
