'use client'

import { useState } from 'react'
import { createGroup } from '@/app/actions/groups'

// Entry point to create a private tier-list group for the current topic. Lives
// above the editor and only renders for signed-in users. On success it swaps
// the modal body for a shareable invite URL — no navigation, so the user can
// keep editing while they send the link.

export function GroupCreateButton({
  topicSlug,
  lang,
}: {
  topicSlug: string
  lang: 'fr' | 'en' | string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ url: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const isFr = lang === 'fr'
  const t = {
    create: isFr ? 'Créer un groupe' : 'Create a group',
    title: isFr ? 'Classer avec des amis' : 'Rank with friends',
    intro: isFr
      ? "Les membres verront ta liste à côté de la leur, et toi la leur. Partage le lien d'invitation à qui tu veux."
      : "Members see your list beside theirs, and you see theirs. Share the invite link with anyone you want in.",
    nameLabel: isFr ? 'Nom du groupe' : 'Group name',
    namePlaceholder: isFr ? 'Les potes du ciné' : 'Movie friends',
    submit: isFr ? 'Créer le groupe' : 'Create group',
    cancel: isFr ? 'Annuler' : 'Cancel',
    inviteHeader: isFr ? 'Lien d\'invitation' : 'Invite link',
    inviteHelp: isFr
      ? 'Qui l\'ouvre et se connecte rejoint le groupe automatiquement.'
      : 'Anyone who opens it and signs in joins automatically.',
    copy: isFr ? 'Copier' : 'Copy',
    copied: isFr ? 'Copié !' : 'Copied!',
    close: isFr ? 'Fermer' : 'Close',
    errRequired: isFr ? 'Donne un nom au groupe.' : 'Give the group a name.',
    errGeneric: isFr ? 'Impossible de créer le groupe.' : 'Could not create the group.',
    errLogin: isFr ? 'Connecte-toi pour créer un groupe.' : 'Sign in to create a group.',
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!name.trim()) { setError(t.errRequired); return }
    setPending(true)
    setError(null)
    try {
      const res = await createGroup(topicSlug, name)
      if (!res.ok) {
        setError(res.error === 'name-required' ? t.errRequired
          : res.error === 'not-logged-in' ? t.errLogin
          : t.errGeneric)
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      setInvite({
        url: `${origin}/${lang}/g/${res.group.inviteSlug}`,
        name: res.group.name,
      })
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setOpen(false)
    setName('')
    setError(null)
    setInvite(null)
    setCopied(false)
  }

  async function copyInvite() {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Some browsers reject clipboard in insecure contexts; fall back to
      // selecting the input so the user can Ctrl+C manually.
      const input = document.getElementById('invite-url-input') as HTMLInputElement | null
      input?.select()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          border: '1.5px solid var(--accent-muted)',
          background: 'var(--accent-faint)',
          color: 'var(--accent-fg)',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden>👥</span>
        {t.create}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
          onClick={ev => { if (ev.target === ev.currentTarget) reset() }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, zIndex: 1000,
          }}
        >
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 22, width: '100%', maxWidth: 460,
            boxShadow: '0 20px 60px rgba(0,0,0,.35)',
          }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: 'var(--fg)', margin: 0, marginBottom: 8 }}>
              {invite ? invite.name : t.title}
            </h2>
            {!invite ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--fg-4)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  {t.intro}
                </p>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-5)' }}>
                    {t.nameLabel}
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      maxLength={60}
                      autoFocus
                      disabled={pending}
                      style={{ padding: '10px 13px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', outline: 'none', textTransform: 'none', letterSpacing: 0 }}
                    />
                  </label>
                  {error && (
                    <div style={{ padding: '8px 12px', borderRadius: 7, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: '#f57c7c', fontSize: 12 }}>
                      {error}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={reset}
                      disabled={pending}
                      style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-5)', fontSize: 13, fontFamily: 'inherit', cursor: pending ? 'default' : 'pointer' }}
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={pending || !name.trim()}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: pending || !name.trim() ? 'default' : 'pointer', opacity: pending || !name.trim() ? 0.6 : 1 }}
                    >
                      {pending ? '…' : t.submit}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-5)', margin: '0 0 6px' }}>
                  {t.inviteHeader}
                </p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <input
                    id="invite-url-input"
                    readOnly
                    value={invite.url}
                    onFocus={e => e.currentTarget.select()}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--fg-2)', fontSize: 12.5, fontFamily: 'monospace', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={copyInvite}
                    style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: copied ? 'var(--accent-fg)' : 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied ? '✓ ' + t.copied : t.copy}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--fg-5)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  {t.inviteHelp}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={reset}
                    style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    {t.close}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
