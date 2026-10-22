'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyGuestStash,
  previewGuestStash,
  type ConflictSummary,
  type GuestMergeStrategy,
  type GuestTopicPayload,
} from '@/app/actions/guestMerge'
import {
  claimAnonymousAccount,
  previewAnonymousClaim,
} from '@/app/actions/guestServerSave'
import {
  clearAllGuestLists,
  clearGuestList,
  clearGuestUserId,
  getGuestUserId,
  readAllGuestLists,
} from '@/lib/guestList'
import { trackEvent } from '@/lib/analytics'

// Mounted in the lang layout for logged-in users. On first render after login,
// surfaces any tier list built before signing in (localStorage stash) and
// either uploads it silently or asks the user how to merge if they already
// have a server list for the same topic.
export function MergeAfterLogin({ lang }: { lang: 'fr' | 'en' }) {
  const router = useRouter()
  const ranRef = useRef(false)
  const [payloads, setPayloads] = useState<GuestTopicPayload[]>([])
  const [conflicts, setConflicts] = useState<ConflictSummary[]>([])
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<GuestMergeStrategy>('keep')
  // If the guest previously saved to the server under an anonymous User, the
  // claim path transfers those rows server-side without re-uploading. Falls
  // back to the pure-localStorage path for guests who built a list in an
  // older version of the app (or in a browser that failed to persist the id).
  const [anonUserId, setAnonUserId] = useState<string | null>(null)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const anonId = getGuestUserId()
    const stash = readAllGuestLists()

    if (anonId) {
      // Server already has the data under the anonymous user. Preview to find
      // conflicts with the real account, then claim.
      void (async () => {
        const preview = await previewAnonymousClaim(anonId)
        if (!preview.ok) {
          // Stale anon id (user deleted on the server, or guestMode logged out
          // after a previous claim) — clear and fall back to the localStorage
          // path below if there is still a stash.
          clearGuestUserId()
          if (stash.length === 0) return
          void runLocalStorageFlow(stash)
          return
        }
        if (preview.conflicts.length === 0) {
          const claim = await claimAnonymousAccount(anonId, 'merge')
          if (claim.ok) {
            trackEvent({
              name: 'guest_claim_completed',
              props: { strategy: 'simple', applied: claim.applied.length, kept: claim.kept.length },
            })
            clearGuestUserId()
            clearAllGuestLists()
            router.refresh()
          }
          return
        }
        setAnonUserId(anonId)
        setConflicts(preview.conflicts.map(c => ({
          topicSlug: c.topicSlug,
          topicTitle: c.topicTitle,
          existingCount: c.existingCount,
          guestCount: c.guestCount,
        })))
        setOpen(true)
      })()
      return
    }

    if (stash.length === 0) return
    void runLocalStorageFlow(stash)

    function runLocalStorageFlow(stash: ReturnType<typeof readAllGuestLists>) {
      const built: GuestTopicPayload[] = stash.map(({ topicSlug, payload }) => ({
        topicSlug,
        items: payload.items.map(i => ({
          entryId: i.entryId,
          tier: i.tier ?? null,
          position: i.position ?? null,
          note: i.note ?? null,
        })),
        rankedTiers: payload.rankedTiers,
      }))

      return (async () => {
        const result = await previewGuestStash(built.map(p => p.topicSlug))
        if (!result.ok) return
        for (const slug of result.missing) clearGuestList(slug)

        if (result.conflicts.length === 0) {
          const apply = await applyGuestStash(built, 'merge')
          if (apply.ok) {
            clearAllGuestLists()
            router.refresh()
          }
          return
        }
        const guestCountBySlug = new Map(built.map(p => [p.topicSlug, p.items.length]))
        setPayloads(built)
        setConflicts(result.conflicts.map(c => ({
          ...c,
          guestCount: guestCountBySlug.get(c.topicSlug) ?? 0,
        })))
        setOpen(true)
      })()
    }
  }, [router])

  async function confirm() {
    setOpen(false)
    if (anonUserId) {
      const claim = await claimAnonymousAccount(anonUserId, choice)
      if (claim.ok) {
        trackEvent({
          name: 'guest_claim_completed',
          props: { strategy: choice, applied: claim.applied.length, kept: claim.kept.length },
        })
        clearGuestUserId()
        clearAllGuestLists()
        router.refresh()
      }
      return
    }
    const apply = await applyGuestStash(payloads, choice)
    if (apply.ok) {
      clearAllGuestLists()
      router.refresh()
    }
  }

  if (!open) return null

  const isFr = lang === 'fr'
  const t = {
    title: isFr ? 'Tu avais commencé un classement avant de te connecter' : 'You had a draft tier list before signing in',
    intro: isFr
      ? 'On a retrouvé ces classements en mode invité. Comment veux-tu les combiner avec ton compte ?'
      : 'We found these draft tier lists. How do you want to combine them with your account?',
    perTopic: (c: ConflictSummary) => isFr
      ? `« ${c.topicTitle} » : tu as déjà ${c.existingCount} film${c.existingCount > 1 ? 's' : ''} sur ton compte, ton brouillon en contient ${c.guestCount}.`
      : `"${c.topicTitle}": ${c.existingCount} item${c.existingCount > 1 ? 's' : ''} on your account, ${c.guestCount} in the draft.`,
    keep: isFr ? 'Garder ma liste actuelle (recommandé)' : 'Keep my current list (recommended)',
    keepDesc: isFr ? 'Le brouillon est jeté.' : 'Discard the draft.',
    merge: isFr ? 'Combiner' : 'Combine',
    mergeDesc: isFr ? 'Mes nouvelles notes écrasent les anciennes pour les films en commun.' : 'New notes override old ones on overlapping items.',
    replace: isFr ? 'Garder mon brouillon' : 'Keep my draft',
    replaceDesc: isFr ? 'Mon ancienne liste est remplacée par le brouillon.' : 'Replace my old list with the draft.',
    confirm: isFr ? 'Valider' : 'Confirm',
  }

  const options: Array<{ value: GuestMergeStrategy; label: string; desc: string }> = [
    { value: 'keep', label: t.keep, desc: t.keepDesc },
    { value: 'merge', label: t.merge, desc: t.mergeDesc },
    { value: 'replace', label: t.replace, desc: t.replaceDesc },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 1000,
      }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 22, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        fontFamily: 'inherit',
      }}>
        <h2 style={{
          fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800,
          color: 'var(--fg)', margin: 0, marginBottom: 8,
        }}>
          {t.title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, margin: 0, marginBottom: 14 }}>
          {t.intro}
        </p>

        <ul style={{
          listStyle: 'none', padding: 0, margin: '0 0 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {conflicts.map(c => (
            <li key={c.topicSlug} style={{
              fontSize: 12, color: 'var(--fg-4)', padding: '8px 12px',
              background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              borderRadius: 8, lineHeight: 1.5,
            }}>
              {t.perTopic(c)}
            </li>
          ))}
        </ul>

        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map(opt => {
            const selected = choice === opt.value
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '12px 14px', borderRadius: 9,
                  border: `1.5px solid ${selected ? 'var(--accent-fg)' : 'var(--border)'}`,
                  background: selected ? 'var(--accent-faint)' : 'var(--bg-card)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color .12s, background .12s',
                }}
              >
                <input
                  type="radio"
                  name="merge-strategy"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setChoice(opt.value)}
                  style={{ marginTop: 2, accentColor: 'var(--accent-fg)' }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 14, color: 'var(--fg)' }}>{opt.label}</strong>
                  <span style={{ fontSize: 12, color: 'var(--fg-5)', lineHeight: 1.4 }}>{opt.desc}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={confirm} style={confirmBtn}>
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

const confirmBtn: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 9, border: 'none',
  background: 'var(--btn)', color: 'var(--btn-text)',
  fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer',
}
