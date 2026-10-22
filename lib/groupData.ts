import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

// Server-side aggregation for the "see what other members ranked" view.
// Session gating is done by the server action that calls these — the cache
// key is the raw groupId so the same payload is reused across members
// (membership check happens at the action layer).

export type GroupListItem = {
  entryId: string
  tier: string | null
  position: number | null
  note: string | null
}

export type GroupMemberList = {
  userId: string
  name: string
  username: string | null
  isOwner: boolean
  // Null when the member has not saved a tier list for the topic yet.
  rankedTiers: string[] | null
  items: GroupListItem[]
}

export type GroupListsPayload = {
  id: string
  name: string
  topicId: string
  topicSlug: string
  topicTitle: string
  members: GroupMemberList[]
}

export function getGroupLists(groupId: string): Promise<GroupListsPayload | null> {
  return unstable_cache(
    async () => {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          topic: { select: { id: true, slug: true, title: true } },
          members: {
            orderBy: { joinedAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, username: true } },
            },
          },
        },
      })
      if (!group) return null

      // One query per member via a batched findMany; we keep it a single
      // query against UserEntryList then group in memory. Lists where the
      // user has no items yet are kept so the UI can render "— pas encore
      // de classement" for that member instead of hiding them.
      const memberUserIds = group.members.map(m => m.userId)
      const lists = await prisma.userEntryList.findMany({
        where: {
          userId: { in: memberUserIds },
          topicId: group.topic.id,
          type: { in: ['TIER', 'BOTH'] },
        },
        include: {
          items: {
            select: { entryId: true, tier: true, position: true, note: true },
          },
        },
      })
      const byUser = new Map<string, (typeof lists)[number]>()
      for (const l of lists) byUser.set(l.userId, l)

      return {
        id: group.id,
        name: group.name,
        topicId: group.topic.id,
        topicSlug: group.topic.slug,
        topicTitle: group.topic.title,
        members: group.members.map(m => {
          const list = byUser.get(m.userId)
          return {
            userId: m.userId,
            name: m.user.name,
            username: m.user.username,
            isOwner: m.role === 'OWNER',
            rankedTiers: list?.rankedTiers ? list.rankedTiers.split(',').filter(Boolean) : null,
            items: list?.items ?? [],
          }
        }),
      }
    },
    [`group-lists-${groupId}`],
    { tags: [`group-${groupId}`] },
  )()
}

export type UserGroupSummary = {
  id: string
  name: string
  inviteSlug: string
  memberCount: number
  isOwner: boolean
}

// Groups the user belongs to for a given topic. Used by the editor to decide
// whether to render the GroupBar when no explicit ?group= is in the URL.
export function getUserGroupsForTopic(
  userId: string,
  topicId: string,
): Promise<UserGroupSummary[]> {
  return unstable_cache(
    async () => {
      const memberships = await prisma.groupMember.findMany({
        where: { userId, group: { topicId } },
        include: {
          group: {
            include: { _count: { select: { members: true } } },
          },
        },
        orderBy: { joinedAt: 'desc' },
      })
      return memberships.map(m => ({
        id: m.group.id,
        name: m.group.name,
        inviteSlug: m.group.inviteSlug,
        memberCount: m.group._count.members,
        isOwner: m.group.ownerId === userId,
      }))
    },
    [`groups-user-${userId}-topic-${topicId}`],
    { tags: [`groups-user-${userId}`] },
  )()
}
