'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { saveTopicTranslation } from '@/app/actions/translations'
import { getDict } from '@/dictionaries/client'
import Link from 'next/link'

export function TranslateTopicForm({
  defaultBadge, defaultTitle, defaultDesc, defaultProse, defaultDiffNote,
}: {
  defaultBadge: string
  defaultTitle: string
  defaultDesc: string
  defaultProse: string
  defaultDiffNote: string
}) {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const dict = getDict(lang)
  const nt = dict.newTopic

  const boundAction = saveTopicTranslation.bind(null, slug, lang)
  const [state, action, pending] = useActionState(boundAction, null)

  const otherLang = lang === 'en' ? 'fr' : 'en'
  const label = lang === 'en' ? 'English' : 'Français'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}/topics/${slug}`} style={{ color: 'var(--fg-6)', fontSize: 13, textDecoration: 'none' }}>
          ← {slug}
        </Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: 'var(--fg)', marginTop: 16, marginBottom: 4 }}>
          {lang === 'en' ? 'Translate to English' : 'Traduire en français'}
        </h1>
        <p style={{ color: 'var(--fg-6)', fontSize: 14 }}>
          {lang === 'en'
            ? `Content currently in French. Fill in the fields in ${label}.`
            : `Contenu actuellement en ${otherLang}. Remplissez les champs en ${label}.`}
        </p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 28 }}>
        {state?.error && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Badge</label>
            <p style={{ fontSize: 11, color: 'var(--fg-7)', marginBottom: 6 }}>{defaultBadge}</p>
            <input name="badge" type="text" required defaultValue={defaultBadge} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{nt.titleLabel}</label>
            <p style={{ fontSize: 11, color: 'var(--fg-7)', marginBottom: 6 }}>{defaultTitle}</p>
            <input name="title" type="text" required defaultValue={defaultTitle} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{nt.descLabel}</label>
            <p style={{ fontSize: 11, color: 'var(--fg-7)', marginBottom: 6 }}>{defaultDesc}</p>
            <textarea name="desc" required rows={2} defaultValue={defaultDesc} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{nt.proseLabel}</label>
            <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--bg-input)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 11, color: 'var(--fg-7)', maxHeight: 100, overflow: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {defaultProse}
            </div>
            <textarea name="prose" rows={10} defaultValue={defaultProse} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 13, outline: 'none', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{nt.diffNoteLabel}</label>
            <p style={{ fontSize: 11, color: 'var(--fg-7)', marginBottom: 6 }}>{defaultDiffNote}</p>
            <input name="diffNote" type="text" defaultValue={defaultDiffNote} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? '...' : (lang === 'en' ? 'Save translation' : 'Enregistrer la traduction')}
            </button>
            <Link href={`/${lang}/topics/${slug}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--fg-6)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              {dict.addNote.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
