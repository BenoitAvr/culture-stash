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
  width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a',
  borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
} as const

const labelStyle = {
  display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '.06em',
} as const

export function EditTopicForm({ topic }: { topic: TopicData }) {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const [state, action, pending] = useActionState(updateTopic, null)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}/topics/${slug}`} style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>
          ← Retour
        </Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: '#f0f0f0', marginTop: 16, marginBottom: 4 }}>
          Modifier le sujet
        </h1>
      </div>

      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28 }}>
        {state?.error && (
          <div style={{ background: '#2a1515', border: '1px solid #5a2020', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
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
              Introduction <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>(HTML simple : &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;)</span>
            </label>
            <textarea name="prose" rows={12} defaultValue={topic.prose}
              style={{ ...inputStyle, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Niveau <span style={{ color: '#555' }}>(1–5)</span></label>
              <input name="diffLevel" type="number" min={1} max={5} defaultValue={topic.diffLevel} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Note sur la complexité</label>
              <input name="diffNote" type="text" defaultValue={topic.diffNote} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Concepts clés <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>(séparés par des virgules)</span>
            </label>
            <input name="concepts" type="text" defaultValue={topic.concepts} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>
              Sujets liés <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>(séparés par des virgules)</span>
            </label>
            <input name="related" type="text" defaultValue={topic.related} style={inputStyle} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input name="rankable" type="checkbox" defaultChecked={topic.rankable}
              style={{ width: 16, height: 16, accentColor: '#c8f55a' }} />
            <span style={{ fontSize: 13, color: '#aaa' }}>Ce sujet permet de classer des œuvres (films, albums, jeux…)</span>
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: '#c8f55a', color: '#0e0e0e', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <Link href={`/${lang}/topics/${slug}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid #2a2a2a', color: '#777', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
