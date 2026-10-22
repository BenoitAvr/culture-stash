'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidateTag } from 'next/cache'
import { getGroupLists, getUserGroupsForTopic, type GroupListsPayload, type UserGroupSummary } from '@/lib/groupData'

// Private tier-list groups scoped per topic. Guests can't create or join —
// the invitation flow surfaces a sign-in prompt in that case.

export type GroupSummary = {
  id: string
  name: string
  inviteSlug: string
  topicSlug: string
  topicTitle: string
  memberCount: number
  isOwner: boolean
}

export type GroupActionResult<T = { group: GroupSummary }> =
  | ({ ok: true } & T)
  | { ok: false; error: 'not-logged-in' | 'topic-not-found' | 'group-not-found' | 'name-required' | 'already-member' }

// URL-safe short random slug — collisions are checked below. 10 chars of
// base36 ≈ 52 bits of entropy, which is overkill for an invite but keeps
// the share URL short and typable.
function generateInviteSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function createGroup(
  topicSlug: string,
  name: string,
): Promise<GroupActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'name-required' }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) return { ok: false, error: 'topic-not-found' }

  // Try a few times in the astronomically-unlikely event of a slug collision.
  let inviteSlug = generateInviteSlug()
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.group.findUnique({ where: { inviteSlug } })
    if (!clash) break
    inviteSlug = generateInviteSlug()
  }

  const group = await prisma.group.create({
    data: {
      name: trimmed,
      inviteSlug,
      topicId: topic.id,
      ownerId: session.userId,
      members: { create: { userId: session.userId, role: 'OWNER' } },
    },
    include: {
      topic: { select: { slug: true, title: true } },
      _count: { select: { members: true } },
    },
  })

  revalidateTag(`groups-user-${session.userId}`, 'max')
  return {
    ok: true,
    group: {
      id: group.id,
      name: group.name,
      inviteSlug: group.inviteSlug,
      topicSlug: group.topic.slug,
      topicTitle: group.topic.title,
      memberCount: group._count.members,
      isOwner: true,
    },
  }
}

// Idempotent — rejoining an existing group is a no-op success so the invite
// link stays usable (e.g. when the owner re-opens their own link).
export async function joinGroup(inviteSlug: string): Promise<GroupActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  const group = await prisma.group.findUnique({
    where: { inviteSlug },
    include: {
      topic: { select: { slug: true, title: true } },
      _count: { select: { members: true } },
    },
  })
  if (!group) return { ok: false, error: 'group-not-found' }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: session.userId } },
  })
  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: session.userId, role: 'MEMBER' },
    })
    revalidateTag(`groups-user-${session.userId}`, 'max')
    revalidateTag(`group-${group.id}`, 'max')
  }

  const memberCount = existing ? group._count.members : group._count.members + 1
  return {
    ok: true,
    group: {
      id: group.id,
      name: group.name,
      inviteSlug: group.inviteSlug,
      topicSlug: group.topic.slug,
      topicTitle: group.topic.title,
      memberCount,
      isOwner: group.ownerId === session.userId,
    },
  }
}

// Membership-gated accessor for the live group view. Returns null if the
// caller is not signed in or not a member — the UI treats both cases as
// "no group context available" without disclosing whether the group exists.
export async function fetchGroupLists(groupId: string): Promise<GroupListsPayload | null> {
  const session = await getSession()
  if (!session) return null
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
    select: { id: true },
  })
  if (!membership) return null
  return getGroupLists(groupId)
}

export async function fetchMyGroupsForTopic(topicSlug: string): Promise<UserGroupSummary[]> {
  const session = await getSession()
  if (!session) return []
  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug }, select: { id: true } })
  if (!topic) return []
  return getUserGroupsForTopic(session.userId, topic.id)
}

export async function leaveGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: 'not-logged-in' | 'group-not-found' | 'owner-cannot-leave' }> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'not-logged-in' }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, ownerId: true } })
  if (!group) return { ok: false, error: 'group-not-found' }

  // Owner has to delete the group instead — otherwise the group has no owner
  // and ownership transfer would need its own UI we don't have yet.
  if (group.ownerId === session.userId) return { ok: false, error: 'owner-cannot-leave' }

  await prisma.groupMember.deleteMany({
    where: { groupId: group.id, userId: session.userId },
  })
  revalidateTag(`groups-user-${session.userId}`, 'max')
  revalidateTag(`group-${group.id}`, 'max')
  return { ok: true }
}
