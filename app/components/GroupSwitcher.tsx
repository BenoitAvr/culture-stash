'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import {
  createGroup,
  fetchMyGroupsForTopic,
  leaveGroup,
  deleteGroup,
} from '@/app/actions/groups'
import type { UserGroupSummary } from '@/lib/groupData'

// Single header entry point for everything group-related on a topic: create a
// new group, switch to one of my existing groups, copy the active group's
// invite link, leave (or delete, if I'm the owner). Lives in the editor
// header beside Importer / Fermer; its label condenses to "Groupe" when no
// group is active, or to the active group's name when one is.

type ViewMode = 'collapsed' | 'create' | 'invite'

export function GroupSwitcher({
  topicSlug,
  lang,
}: {
  topicSlug: string
  lang: 'fr' | 'en' | string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang: _lang } = useParams() as { lang: string }
  void _lang
  const activeGroupId = searchParams.get('group')

  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<UserGroupSummary[] | null>(null)
  const [mode, setMode] = useState<ViewMode>('collapsed')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Freshly-created / selected group's invite URL, shown in "invite" mode so
  // the user can copy it right after creation or anytime after by selecting
  // "Copier le lien" on an existing group.
  const [inviteFor, setInviteFor] = useState<UserGroupSummary | null>(null)
  const [copied, setCopied] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const isFr = lang === 'fr'
  const t = {
    collapsedLabelNone: isFr ? 'Groupe' : 'Group',
    collapsedLabelCreate: isFr ? 'Créer un groupe' : 'Create a group',
    menuMyGroups: isFr ? 'Mes groupes' : 'My groups',
    createNew: isFr ? '+ Créer un groupe' : '+ Create a group',
    createTitle: isFr ? 'Nouveau groupe' : 'New group',
    nameLabel: isFr ? 'Nom du groupe' : 'Group name',
    namePlaceholder: isFr ? 'Les potes du ciné' : 'Movie friends',
    createBtn: isFr ? 'Créer' : 'Create',
    cancel: isFr ? 'Annuler' : 'Cancel',
    inviteHeader: isFr ? 'Lien d\'invitation' : 'Invite link',
    inviteHelp: isFr ? 'Qui l\'ouvre et se connecte rejoint automatiquement.' : 'Anyone who opens it and signs in joins automatically.',
    copy: isFr ? 'Copier' : 'Copy',
    copied: isFr ? 'Copié !' : 'Copied!',
    back: isFr ? '← Retour' : '← Back',
    invite: isFr ? 'Copier le lien' : 'Copy link',
    leave: isFr ? 'Quitter' : 'Leave',
    delete: isFr ? 'Supprimer' : 'Delete',
    exitView: isFr ? 'Quitter la vue groupe' : 'Exit group view',
    confirmLeave: isFr ? 'Quitter ce groupe ?' : 'Leave this group?',
    confirmDelete: isFr ? 'Supprimer définitivement ce groupe pour tous ses membres ?' : 'Permanently delete this group for every member?',
    members: (n: number) => isFr ? `${n} membre${n > 1 ? 's' : ''}` : `${n} member${n > 1 ? 's' : ''}`,
    errRequired: isFr ? 'Donne un nom au groupe.' : 'Give the group a name.',
    errGeneric: isFr ? 'Impossible de créer le groupe.' : 'Could not create the group.',
    noGroups: isFr ? 'Pas encore de groupe. Crée-en un pour comparer vos listes.' : 'No groups yet. Create one to compare your lists.',
  }

  // Load my groups the first time the dropdown opens — avoids a query per
  // mount for users who never touch it.
  useEffect(() => {
    if (!open || groups !== null) return
    void (async () => {
      const g = await fetchMyGroupsForTopic(topicSlug)
      setGroups(g)
    })()
  }, [open, groups, topicSlug])

  useEffect(() => {
    if (!open) return
    const onPointer = (ev: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setOpen(false)
        setMode('collapsed')
      }
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { setOpen(false); setMode('collapsed') }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const activeGroup = groups?.find(g => g.id === activeGroupId) ?? null

  function pathWithGroup(id: string | null) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (id) sp.set('group', id)
    else sp.delete('group')
    const qs = sp.toString()
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`
  }

  function switchTo(id: string | null) {
    router.push(pathWithGroup(id))
    setOpen(false)
    setMode('collapsed')
  }

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault()
    if (!name.trim()) { setError(t.errRequired); return }
    setPending(true); setError(null)
    const res = await createGroup(topicSlug, name)
    setPending(false)
    if (!res.ok) {
      setError(res.error === 'name-required' ? t.errRequired : t.errGeneric)
      return
    }
    const summary: UserGroupSummary = {
      id: res.group.id,
      name: res.group.name,
      inviteSlug: res.group.inviteSlug,
      memberCount: res.group.memberCount,
      isOwner: true,
    }
    setGroups(prev => [summary, ...(prev ?? [])])
    setName('')
    setInviteFor(summary)
    setMode('invite')
    // Also navigate into the fresh group so the member bar + pastilles mount.
    router.push(pathWithGroup(summary.id))
  }

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      const input = document.getElementById('switcher-invite-url') as HTMLInputElement | null
      input?.select()
    }
  }

  async function handleLeave(group: UserGroupSummary) {
    if (!confirm(t.confirmLeave)) return
    const res = await leaveGroup(group.id)
    if (res.ok) {
      setGroups(prev => (prev ?? []).filter(g => g.id !== group.id))
      if (activeGroupId === group.id) router.push(pathWithGroup(null))
    }
  }

  async function handleDelete(group: UserGroupSummary) {
    if (!confirm(t.confirmDelete)) return
    const res = await deleteGroup(group.id)
    if (res.ok) {
      setGroups(prev => (prev ?? []).filter(g => g.id !== group.id))
      if (activeGroupId === group.id) router.push(pathWithGroup(null))
    }
  }

  const buttonLabel = activeGroup ? activeGroup.name : (groups && groups.length > 0 ? t.collapsedLabelNone : t.collapsedLabelCreate)
  const buttonActive = activeGroup != null

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setMode('collapsed') }}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          border: `1.5px solid ${buttonActive ? 'var(--accent-fg)' : 'var(--accent-muted)'}`,
          background: 'var(--accent-faint)',
          color: 'var(--accent-fg)',
          fontSize: 12, fontWeight: buttonActive ? 700 : 600, fontFamily: 'inherit',
          cursor: 'pointer', whiteSpace: 'nowrap',
          maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        <span aria-hidden>👥</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{buttonLabel}</span>
        <span aria-hidden style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            width: 300,
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 10px 32px rgba(0,0,0,.18)',
            padding: 10,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          {mode === 'collapsed' && (
            <>
              {groups === null ? (
                <div style={{ fontSize: 12, color: 'var(--fg-7)', padding: '12px 4px', textAlign: 'center' }}>…</div>
              ) : groups.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--fg-6)', padding: '6px 4px', lineHeight: 1.5 }}>
                  {t.noGroups}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)', padding: '2px 4px' }}>
                    {t.menuMyGroups}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activeGroupId && (
                      <button
                        type="button"
                        onClick={() => switchTo(null)}
                        style={groupRowBtnStyle(false)}
                      >
                        <span style={{ fontSize: 13, color: 'var(--fg-5)', fontStyle: 'italic' }}>{t.exitView}</span>
                      </button>
                    )}
                    {groups.map(g => {
                      const isActive = g.id === activeGroupId
                      return (
                        <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 2, borderRadius: 7, background: isActive ? 'var(--accent-faint)' : 'transparent' }}>
                          <button
                            type="button"
                            onClick={() => switchTo(g.id)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                              padding: '6px 8px', borderRadius: 6,
                              border: 'none', background: 'transparent',
                              color: 'var(--fg-2)', fontSize: 13, fontWeight: isActive ? 700 : 600,
                              fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              {g.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {t.members(g.memberCount)}{g.isOwner ? ' · ★' : ''}
                            </span>
                          </button>
                          {isActive && (
                            <div style={{ display: 'flex', gap: 4, padding: '0 4px 4px' }}>
                              <button
                                type="button"
                                onClick={() => { setInviteFor(g); setMode('invite') }}
                                style={smallActionStyle}
                              >
                                {t.invite}
                              </button>
                              {g.isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(g)}
                                  style={{ ...smallActionStyle, color: '#e05555', borderColor: '#e0555544' }}
                                >
                                  {t.delete}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleLeave(g)}
                                  style={{ ...smallActionStyle, color: '#e05555', borderColor: '#e0555544' }}
                                >
                                  {t.leave}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              <button
                type="button"
                onClick={() => setMode('create')}
                style={{
                  padding: '8px 10px', borderRadius: 7,
                  border: '1px dashed var(--accent-muted)',
                  background: 'transparent',
                  color: 'var(--accent-fg)',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {t.createNew}
              </button>
            </>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)' }}>
                {t.createTitle}
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: 'var(--fg-6)' }}>
                {t.nameLabel}
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  maxLength={60}
                  autoFocus
                  disabled={pending}
                  style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
              </label>
              {error && (
                <div style={{ fontSize: 11, color: '#f57c7c', padding: '4px 2px' }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setMode('collapsed'); setError(null); setName('') }}
                  disabled={pending}
                  style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-5)', fontSize: 12, fontFamily: 'inherit', cursor: pending ? 'default' : 'pointer' }}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: pending || !name.trim() ? 'default' : 'pointer', opacity: pending || !name.trim() ? 0.5 : 1 }}
                >
                  {pending ? '…' : t.createBtn}
                </button>
              </div>
            </form>
          )}

          {mode === 'invite' && inviteFor && (() => {
            const origin = typeof window !== 'undefined' ? window.location.origin : ''
            const url = `${origin}/${lang}/g/${inviteFor.inviteSlug}`
            return (
              <>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-6)' }}>
                  {t.inviteHeader} — {inviteFor.name}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    id="switcher-invite-url"
                    readOnly
                    value={url}
                    onFocus={e => e.currentTarget.select()}
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg-2)', fontSize: 11.5, fontFamily: 'monospace', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => copyInvite(url)}
                    style={{ padding: '0 12px', borderRadius: 7, border: 'none', background: copied ? 'var(--accent-fg)' : 'var(--btn)', color: 'var(--btn-text)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied ? '✓ ' + t.copied : t.copy}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--fg-6)', lineHeight: 1.4, margin: 0 }}>{t.inviteHelp}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => { setMode('collapsed'); setInviteFor(null) }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--fg-5)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    {t.back}
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

const smallActionStyle: React.CSSProperties = {
  padding: '4px 9px', borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--fg-4)',
  fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
  cursor: 'pointer',
}

function groupRowBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center',
    padding: '6px 8px', borderRadius: 6,
    border: 'none', background: active ? 'var(--accent-faint)' : 'transparent',
    color: 'var(--fg-5)', fontSize: 13, fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
  }
}
