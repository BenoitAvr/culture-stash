'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import { addResource } from '@/app/actions/resources'
import { getDict } from '@/dictionaries/client'
import Link from 'next/link'

const TYPE_KEYS = ['video', 'livre', 'cours', 'podcast', 'album', 'film'] as const
const TYPE_EMOJIS: Record<string, string> = {
  video: '🎬 ', livre: '📚 ', cours: '🎓 ', podcast: '🎙️ ', album: '💿 ', film: '🎞️ ',
}

export function AddResourceForm() {
  const { lang, slug } = useParams() as { lang: string; slug: string }
  const dict = getDict(lang)
  const t = dict.addResource
  const [state, action, pending] = useActionState(addResource, null)

  const typeLabels: Record<string, string> = {
    video: `${TYPE_EMOJIS.video}${lang === 'en' ? 'Video / Documentary' : 'Vidéo / Documentaire'}`,
    livre: `${TYPE_EMOJIS.livre}${lang === 'en' ? 'Book' : 'Livre'}`,
    cours: `${TYPE_EMOJIS.cours}${lang === 'en' ? 'Online course' : 'Cours en ligne'}`,
    podcast: `${TYPE_EMOJIS.podcast}Podcast`,
    album: `${TYPE_EMOJIS.album}Album`,
    film: `${TYPE_EMOJIS.film}${lang === 'en' ? 'Film' : 'Film'}`,
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/${lang}/topics/${slug}`} style={{ color: 'var(--fg-6)', fontSize: 13, textDecoration: 'none' }}>
          {t.back} {slug}
        </Link>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: 'var(--fg)', marginTop: 16, marginBottom: 4 }}>
          {t.pageTitle}
        </h1>
        <p style={{ color: 'var(--fg-6)', fontSize: 14 }}>{t.subtitle}</p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 28 }}>
        {state?.error && (
          <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#f57c7c', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <input type="hidden" name="topicSlug" value={slug} />
          <input type="hidden" name="lang" value={lang} />

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.typeLabel}</label>
            <select name="type" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="">{t.chooseType}</option>
              {TYPE_KEYS.map(k => <option key={k} value={k}>{typeLabels[k]}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
            <input name="title" type="text" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.sourceLabel}</label>
            <input name="sub" type="text" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.urlLabel} <span style={{ color: 'var(--fg-7)', textTransform: 'none', letterSpacing: 0 }}>{t.urlOptional}</span>
            </label>
            <input name="url" type="url" placeholder="https://..." style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={pending} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? t.submitting : t.submit}
            </button>
            <Link href={`/${lang}/topics/${slug}`} style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--fg-6)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              {t.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
