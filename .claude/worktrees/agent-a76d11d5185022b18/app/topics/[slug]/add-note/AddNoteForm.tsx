'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { createNote } from '@/app/actions/notes'
import { getDict } from '@/dictionaries/client'
import Link from 'next/link'

export function AddNoteForm() {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const t = getDict(lang).addNote
  const [state, action, pending] = useActionState(createNote, null)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}/topics/${slug}`} style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>
          {t.back} {slug}
        </Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: '#f0f0f0', marginTop: 16, marginBottom: 4 }}>
          {t.pageTitle}
        </h1>
        <p style={{ color: '#777', fontSize: 14 }}>{t.subtitle}</p>
      </div>

      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28 }}>
        {state?.error && (
          <div style={{ background: '#2a1515', border: '1px solid #5a2020', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <input type="hidden" name="topicSlug" value={slug} />
          <input type="hidden" name="lang" value={lang} />

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
            <input name="title" type="text" required style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.contentLabel}</label>
            <textarea name="content" required rows={10} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.tagsLabel} <span style={{ color: '#555', textTransform: 'none', letterSpacing: 0 }}>{t.tagsHint}</span>
            </label>
            <input name="tags" type="text" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: '#f5a623', color: '#0e0e0e', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? t.submitting : t.submit}
            </button>
            <Link href={`/${lang}/topics/${slug}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid #2a2a2a', color: '#777', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              {t.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
