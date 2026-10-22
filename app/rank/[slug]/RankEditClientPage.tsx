'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { UserEntryListSection, type UserEntryListData, type MemberBadge } from './UserEntryListSection'
import { GroupBar } from '@/app/components/GroupBar'
import { GroupMemberListView } from '@/app/components/GroupMemberListView'
import { fetchGroupLists } from '@/app/actions/groups'
import type { Dict } from '@/dictionaries/client'
import type { GroupListsPayload } from '@/lib/groupData'

type EntryItem = { id: string; title: string; titleEn: string | null; year: number | null; cover: string | null; tierCount?: number; score?: number; kind?: 'FILM' | 'SAGA'; genres?: number[] }

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
  const searchParams = useSearchParams()
  const groupId = searchParams.get('group')
  const [lists, setLists] = useState<UserEntryListData[]>(initialLists)
  // null = viewing self (editor); a userId = viewing that member in read-only.
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [groupPayload, setGroupPayload] = useState<GroupListsPayload | null>(null)

  // Reset the active viewer whenever the group changes (navigation to a
  // different ?group= value).
  useEffect(() => { setViewingUserId(null) }, [groupId])

  // Fetch the group payload for the member-list view. GroupBar also fetches
  // (with polling) — we keep a separate cheap copy here so swapping to a
  // member's view doesn't need to wait on anything. Both calls hit the same
  // cached action under the hood.
  useEffect(() => {
    if (!groupId || !currentUserId) { setGroupPayload(null); return }
    let cancelled = false
    void (async () => {
      const res = await fetchGroupLists(groupId)
      if (!cancelled) setGroupPayload(res)
    })()
    return () => { cancelled = true }
  }, [groupId, currentUserId])

  function handleSetIsEditing(v: boolean) {
    if (v) return
    // Logged-in users land on their shareable public URL after closing.
    // Guests have no public list yet — bring them back to the community page.
    const target = ownerUsername
      ? `/${lang}/rank/${topicSlug}/${encodeURIComponent(ownerUsername)}`
      : `/${lang}/rank/${topicSlug}`
    router.push(target)
  }

  const viewingMember = viewingUserId && groupPayload
    ? groupPayload.members.find(m => m.userId === viewingUserId) ?? null
    : null

  // Collect what each other member put each entry in, keyed by entryId.
  // The editor shows these as small coloured pastilles on my tier cards so
  // I can spot "ah, lui l'a mis en MA" without swapping views. Rebuilt
  // whenever the polled payload updates.
  const memberBadgesByEntryId = useMemo<Record<string, MemberBadge[]>>(() => {
    if (!groupPayload) return {}
    const map: Record<string, MemberBadge[]> = {}
    for (const m of groupPayload.members) {
      if (m.userId === currentUserId) continue
      for (const item of m.items) {
        if (!item.tier) continue
        if (!map[item.entryId]) map[item.entryId] = []
        map[item.entryId].push({ userId: m.userId, memberName: m.name, tier: item.tier })
      }
    }
    return map
  }, [groupPayload, currentUserId])

  return (
    <div className="rank-edit-shell page-lg" style={{ margin: '0 auto', padding: '24px 24px 60px' }}>
      {groupId && currentUserId && (
        <GroupBar
          groupId={groupId}
          currentUserId={currentUserId}
          lang={lang}
          viewingUserId={viewingUserId}
          onViewUser={setViewingUserId}
        />
      )}
      {viewingMember ? (
        <GroupMemberListView
          memberName={viewingMember.name}
          items={viewingMember.items}
          entries={entries}
          lang={lang}
        />
      ) : (
        <UserEntryListSection
          topicSlug={topicSlug}
          entries={entries}
          lists={lists}
          onListsChange={setLists}
          currentUserId={currentUserId}
          isEditing={true}
          setIsEditing={handleSetIsEditing}
          t={t}
          memberBadgesByEntryId={memberBadgesByEntryId}
        />
      )}
    </div>
  )
}
