'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { createTopic } from '@/app/actions/topics'
import { getDict } from '@/dictionaries/client'
import Link from 'next/link'

type TopicOption = { id: string; slug: string; emoji: string; title: string }

export function NewTopicForm({ topics, defaultParentId }: { topics: TopicOption[]; defaultParentId: string | null }) {
  const { lang } = useParams() as { lang: string }
  const t = getDict(lang).newTopic
  const [state, action, pending] = useActionState(createTopic, null)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}`} style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>{t.back}</Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: '#f0f0f0', marginTop: 16, marginBottom: 4 }}>{t.pageTitle}</h1>
        <p style={{ color: '#777', fontSize: 14 }}>{t.subtitle}</p>
      </div>

      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28 }}>
        {state?.error && (
          <div style={{ background: '#2a1515', border: '1px solid #5a2020', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.emojiLabel}</label>
              <input name="emoji" type="text" required maxLength={4} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 24, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
              <input name="title" type="text" required style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.categoryLabel}</label>
            <input name="badge" type="text" required style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.descLabel}</label>
            <textarea name="desc" required rows={2} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.proseLabel} <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>{t.proseHint}</span>
            </label>
            <textarea name="prose" rows={8} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 13, outline: 'none', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.levelLabel} <span style={{ color: '#555' }}>{t.levelHint}</span></label>
              <input name="diffLevel" type="number" min={1} max={5} defaultValue={3} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.diffNoteLabel}</label>
              <input name="diffNote" type="text" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.conceptsLabel} <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>{t.conceptsHint}</span>
            </label>
            <input name="concepts" type="text" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.relatedLabel} <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>{t.relatedHint}</span>
            </label>
            <input name="related" type="text" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Sujet parent <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
            </label>
            {defaultParentId ? (
              <>
                <input type="hidden" name="parentId" value={defaultParentId} />
                <div style={{ padding: '10px 14px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 14, color: '#777' }}>
                  {topics.find(t => t.id === defaultParentId)?.emoji} {topics.find(t => t.id === defaultParentId)?.title}
                </div>
              </>
            ) : (
              <select name="parentId" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="">— Aucun parent —</option>
                {topics.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.emoji} {tp.title}</option>
                ))}
              </select>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input name="rankable" type="checkbox" style={{ width: 16, height: 16, accentColor: '#c8f55a' }} />
            <span style={{ fontSize: 13, color: '#aaa' }}>{getDict(lang).rank.rankableLabel}</span>
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: '#c8f55a', color: '#0e0e0e', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? t.submitting : t.submit}
            </button>
            <Link href={`/${lang}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid #2a2a2a', color: '#777', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              {t.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
