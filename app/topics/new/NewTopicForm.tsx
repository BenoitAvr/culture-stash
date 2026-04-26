'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { createTopic } from '@/app/actions/topics'
import { getDict } from '@/dictionaries/client'
import Link from 'next/link'

type TopicOption = { id: string; slug: string; emoji: string; title: string }

export function NewTopicForm({ topics, defaultParentId, defaultRankable = false }: { topics: TopicOption[]; defaultParentId: string | null; defaultRankable?: boolean }) {
  const { lang } = useParams() as { lang: string }
  const t = getDict(lang).newTopic
  const [state, action, pending] = useActionState(createTopic, null)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}`} style={{ color: 'var(--fg-6)', fontSize: 13, textDecoration: 'none' }}>{t.back}</Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: 'var(--fg)', marginTop: 16, marginBottom: 4 }}>{t.pageTitle}</h1>
        <p style={{ color: 'var(--fg-6)', fontSize: 14 }}>{t.subtitle}</p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 28 }}>
        {state?.error && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {defaultRankable ? (
            /* ── Mode classement : formulaire minimal ── */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {t.emojiLabel} <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
                  </label>
                  <input name="emoji" type="text" maxLength={4} placeholder="🎬" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 24, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
                  <input name="title" type="text" required autoFocus style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t.categoryLabel} <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
                </label>
                <input name="badge" type="text" placeholder="Cinéma, Musique, Sport…" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>

              <input type="hidden" name="rankable" value="on" />
            </>
          ) : (
            /* ── Mode apprentissage : formulaire complet ── */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.emojiLabel}</label>
                  <input name="emoji" type="text" required maxLength={4} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 24, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
                  <input name="title" type="text" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.categoryLabel}</label>
                <input name="badge" type="text" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.descLabel}</label>
                <textarea name="desc" required rows={2} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t.proseLabel} <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>{t.proseHint}</span>
                </label>
                <textarea name="prose" rows={8} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 13, outline: 'none', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.levelLabel} <span style={{ color: 'var(--fg-7)' }}>{t.levelHint}</span></label>
                  <input name="diffLevel" type="number" min={1} max={5} defaultValue={3} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.diffNoteLabel}</label>
                  <input name="diffNote" type="text" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t.conceptsLabel} <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>{t.conceptsHint}</span>
                </label>
                <input name="concepts" type="text" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t.relatedLabel} <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>{t.relatedHint}</span>
                </label>
                <input name="related" type="text" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Sujet parent <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
                </label>
                {defaultParentId ? (
                  <>
                    <input type="hidden" name="parentId" value={defaultParentId} />
                    <div style={{ padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--fg-6)' }}>
                      {topics.find(t => t.id === defaultParentId)?.emoji} {topics.find(t => t.id === defaultParentId)?.title}
                    </div>
                  </>
                ) : (
                  <select name="parentId" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <option value="">— Aucun parent —</option>
                    {topics.map(tp => (
                      <option key={tp.id} value={tp.id}>{tp.emoji} {tp.title}</option>
                    ))}
                  </select>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input name="rankable" type="checkbox" defaultChecked={defaultRankable} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{getDict(lang).rank.rankableLabel}</span>
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? t.submitting : t.submit}
            </button>
            <Link href={`/${lang}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--fg-6)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              {t.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
