'use client'

import { useState, useTransition } from 'react'
import { submitFeedback, type FeedbackResult } from '@/app/actions/feedback'

type Labels = {
  open: string
  title: string
  help: string
  messagePlaceholder: string
  contactLabel: string
  contactPlaceholder: string
  contactLoggedIn: string
  submit: string
  cancel: string
  sent: string
  errorEmpty: string
  errorTooLong: string
  errorNotConfigured: string
  errorFailed: string
}

export function FeedbackWidget({
  labels,
  loggedInName,
}: {
  labels: Labels
  loggedInName: string | null
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  function close() {
    setOpen(false)
    setError(null)
    setSent(false)
    setMessage('')
    setContact('')
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result: FeedbackResult = await submitFeedback({ message, contact: contact || undefined })
      if (result.ok) {
        setSent(true)
        setTimeout(close, 1800)
        return
      }
      const map: Record<typeof result.error, string> = {
        empty: labels.errorEmpty,
        'too-long': labels.errorTooLong,
        'not-configured': labels.errorNotConfigured,
        'webhook-failed': labels.errorFailed,
      }
      setError(map[result.error])
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={labels.open}
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 90,
          width: 44, height: 44, borderRadius: 22,
          background: 'var(--btn)', color: 'var(--btn-text)',
          border: 'none', cursor: 'pointer',
          fontSize: 20, lineHeight: 1,
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label={labels.open}
      >
        💬
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20, width: '100%', maxWidth: 460,
              display: 'flex', flexDirection: 'column', gap: 12,
              fontFamily: 'inherit',
            }}
          >
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: 'var(--fg)', margin: 0 }}>
              {labels.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, margin: 0 }}>
              {labels.help}
            </p>

            {sent ? (
              <p style={{ fontSize: 14, color: 'var(--accent-fg)', margin: '8px 0' }}>{labels.sent}</p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={e => { setMessage(e.target.value); setError(null) }}
                  placeholder={labels.messagePlaceholder}
                  rows={6}
                  maxLength={2000}
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    fontFamily: 'inherit', fontSize: 13,
                    background: 'var(--bg-input)', color: 'var(--fg)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '10px 12px', resize: 'vertical', outline: 'none',
                  }}
                />
                {loggedInName ? (
                  <p style={{ fontSize: 11, color: 'var(--fg-5)', margin: 0 }}>
                    {labels.contactLoggedIn.replace('{name}', loggedInName)}
                  </p>
                ) : (
                  <input
                    type="email"
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    placeholder={`${labels.contactLabel} ${labels.contactPlaceholder}`}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      fontFamily: 'inherit', fontSize: 13,
                      background: 'var(--bg-input)', color: 'var(--fg)',
                      border: '1px solid var(--border)', borderRadius: 8,
                      padding: '8px 12px', outline: 'none',
                    }}
                  />
                )}

                {error && (
                  <span style={{ fontSize: 12, color: '#e05555' }}>{error}</span>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={close}
                    disabled={isPending}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'none', color: 'var(--fg-3)',
                      border: '1px solid var(--border)',
                      fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {labels.cancel}
                  </button>
                  <button
                    onClick={submit}
                    disabled={isPending || !message.trim()}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'var(--btn)', color: 'var(--btn-text)',
                      border: 'none',
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      cursor: isPending || !message.trim() ? 'not-allowed' : 'pointer',
                      opacity: isPending || !message.trim() ? 0.6 : 1,
                    }}
                  >
                    {isPending ? '…' : labels.submit}
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
