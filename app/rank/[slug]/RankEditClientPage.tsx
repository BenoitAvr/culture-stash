'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { UserEntryListSection, type UserEntryListData } from './UserEntryListSection'
import type { Dict } from '@/dictionaries/client'

type EntryItem = { id: string; title: string; titleEn: string | null; year: number | null }

export function RankEditClientPage({
  topicSlug,
  entries,
  initialLists,
  currentUserId,
  t,
}: {
  topicSlug: string
  entries: EntryItem[]
  initialLists: UserEntryListData[]
  currentUserId: string
  t: Dict['rankings']
}) {
  const router = useRouter()
  const { lang } = useParams() as { lang: string }
  const [lists, setLists] = useState<UserEntryListData[]>(initialLists)

  function handleSetIsEditing(v: boolean) {
    if (!v) router.push(`/${lang}/rank/${topicSlug}`)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px 60px' }}>
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
