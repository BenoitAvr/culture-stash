'use client'

import { useEffect, useState } from 'react'
import { fetchGroupLists } from '@/app/actions/groups'
import type { GroupListsPayload } from '@/lib/groupData'

// Thin presentational wrapper rendered above the editor whenever the current
// user is in a group for the active topic. Lets them pick which member's list
// to look at — "self" means we show the normal editor; a chosen member swaps
// the editor out for a GroupMemberListView.

export function GroupBar({
  groupId,
  currentUserId,
  lang,
  viewingUserId,
  onViewUser,
  pollMs = 15000,
}: {
  groupId: string
  currentUserId: string
  lang: string
  // null = viewing self (edit mode); a userId = viewing that member in read-only
  viewingUserId: string | null
  onViewUser: (userId: string | null) => void
  pollMs?: number
}) {
  const [payload, setPayload] = useState<GroupListsPayload | null>(null)
  const [error, setError] = useState(false)

  // Initial load + polling while the tab is visible. Doesn't poll in the
  // background to keep battery/CPU quiet; a visibility change triggers a
  // fresh fetch so the user sees the latest state when they come back.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetchGroupLists(groupId)
        if (!cancelled) {
          setPayload(res)
          setError(res === null)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          timer = setTimeout(tick, pollMs)
        }
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (timer) { clearTimeout(timer); timer = null }
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [groupId, pollMs])

  if (error || !payload) return null

  const isFr = lang === 'fr'
  const sortedMembers = [...payload.members].sort((a, b) => {
    // Me first, then owner, then alphabetical by name
    if (a.userId === currentUserId) return -1
    if (b.userId === currentUserId) return 1
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1
    return a.name.localeCompare(b.name, lang)
  })

  function initials(name: string) {
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map(p => p.charAt(0).toUpperCase()).join('') || '?'
  }

  // Deterministic hue per userId so an avatar's colour stays the same across
  // sessions and views — makes someone recognisable in a glance.
  function avatarColor(userId: string) {
    let h = 0
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
    return `hsl(${h % 360} 60% 55%)`
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 14px',
      marginBottom: 12,
      background: 'var(--bg-card)',
      border: '1px solid var(--accent-muted)',
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span aria-hidden style={{ fontSize: 16 }}>👥</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', lineHeight: 1 }}>
            {isFr ? 'Groupe' : 'Group'}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 15, color: 'var(--fg)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {payload.name}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
        {sortedMembers.map(m => {
          const isMe = m.userId === currentUserId
          // Selected iff the user is actively viewing this member's slot.
          // Me-is-selected when nothing else is picked.
          const selected = (viewingUserId === null && isMe) || viewingUserId === m.userId
          const label = isMe ? (isFr ? 'Moi' : 'Me') : m.name.split(/\s+/)[0]
          const empty = m.items.filter(i => i.tier).length === 0
          return (
            <button
              key={m.userId}
              type="button"
              onClick={() => onViewUser(isMe ? null : m.userId)}
              title={isMe ? (isFr ? 'Revenir à ma liste' : 'Back to my list') : `${m.name}${empty ? (isFr ? ' — pas encore classé' : ' — not yet ranked') : ''}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px 4px 4px',
                borderRadius: 999,
                border: `1.5px solid ${selected ? 'var(--accent-fg)' : 'var(--border)'}`,
                background: selected ? 'var(--accent-faint)' : 'var(--bg-input)',
                color: selected ? 'var(--accent-fg)' : 'var(--fg-3)',
                fontSize: 12, fontWeight: selected ? 700 : 600,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: empty && !isMe ? 0.6 : 1,
                transition: 'border-color .12s, background .12s',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                background: avatarColor(m.userId), color: '#fff',
                fontSize: 10, fontWeight: 800, letterSpacing: '.02em',
                flexShrink: 0,
              }}>
                {initials(m.name)}
              </span>
              {label}
              {m.isOwner && !isMe && (
                <span aria-label="Owner" title={isFr ? 'Créateur' : 'Owner'} style={{ fontSize: 10, opacity: 0.75 }}>★</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
