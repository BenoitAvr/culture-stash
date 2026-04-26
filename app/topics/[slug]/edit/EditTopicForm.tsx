'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { updateTopic } from '@/app/actions/topics'
import Link from 'next/link'

type TopicData = {
  id: string
  slug: string
  emoji: string
  badge: string
  title: string
  desc: string
  prose: string
  diffLevel: number
  diffNote: string
  rankable: boolean
  concepts: string
  related: string
}

const inputStyle = {
  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
} as const

const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '.06em',
} as const

export function EditTopicForm({ topic }: { topic: TopicData }) {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const [state, action, pending] = useActionState(updateTopic, null)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}/topics/${slug}`} style={{ color: 'var(--fg-6)', fontSize: 13, textDecoration: 'none' }}>
          ← Retour
        </Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: 'var(--fg)', marginTop: 16, marginBottom: 4 }}>
          Modifier le sujet
        </h1>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 28 }}>
        {state?.error && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <input type="hidden" name="topicId" value={topic.id} />
          <input type="hidden" name="lang" value={lang} />

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Emoji</label>
              <input name="emoji" type="text" required maxLength={4} defaultValue={topic.emoji}
                style={{ ...inputStyle, fontSize: 24, textAlign: 'center' }} />
            </div>
            <div>
              <label style={labelStyle}>Titre</label>
              <input name="title" type="text" required defaultValue={topic.title} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Catégorie</label>
            <input name="badge" type="text" required defaultValue={topic.badge} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description courte</label>
            <textarea name="desc" required rows={2} defaultValue={topic.desc}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div>
            <label style={labelStyle}>
              Introduction <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>(HTML simple : &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;)</span>
            </label>
            <textarea name="prose" rows={12} defaultValue={topic.prose}
              style={{ ...inputStyle, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Niveau <span style={{ color: 'var(--fg-7)' }}>(1–5)</span></label>
              <input name="diffLevel" type="number" min={1} max={5} defaultValue={topic.diffLevel} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Note sur la complexité</label>
              <input name="diffNote" type="text" defaultValue={topic.diffNote} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Concepts clés <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>(séparés par des virgules)</span>
            </label>
            <input name="concepts" type="text" defaultValue={topic.concepts} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>
              Sujets liés <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>(séparés par des virgules)</span>
            </label>
            <input name="related" type="text" defaultValue={topic.related} style={inputStyle} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input name="rankable" type="checkbox" defaultChecked={topic.rankable}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Ce sujet permet de classer des œuvres (films, albums, jeux…)</span>
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <Link href={`/${lang}/topics/${slug}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--fg-6)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
