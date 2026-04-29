'use client'

import { useActionState, useState } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { addEntry } from '@/app/actions/entries'
import { UserEntryListSection, type UserEntryListData } from './UserEntryListSection'
import Link from 'next/link'

type Entry = {
  id: string
  title: string
  year: number | null
  cover: string | null
  avgRank: number | null
  rankCount: number
  userNote: string | null
}

function EntryRow({ entry, rank, t }: { entry: Entry; rank: number; t: ReturnType<typeof getDict>['rank'] }) {
  const isTop3 = rank <= 3

  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
      {/* Rank number */}
      <span style={{
        fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, lineHeight: 1,
        color: isTop3 ? 'var(--accent-fg)' : 'var(--fg-8)',
        width: 30, flexShrink: 0, textAlign: 'right', paddingTop: 3,
      }}>{rank}</span>

      {/* Cover */}
      {entry.cover
        ? <img src={entry.cover} alt={entry.title} style={{ width: 38, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.12)' }} />
        : <div style={{ width: 38, height: 54, borderRadius: 4, background: 'var(--bg-subtle)', flexShrink: 0 }} />
      }

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.2 }}>{entry.title}</span>
          {entry.year && <span style={{ fontSize: 12, color: 'var(--fg-7)' }}>{entry.year}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {entry.avgRank !== null && (
            <span style={{ fontSize: 12, color: 'var(--fg-6)' }}>
              <span style={{ fontWeight: 600, color: 'var(--fg-4)' }}>#{entry.avgRank.toFixed(1)}</span>
              {' '}<span style={{ color: 'var(--fg-8)' }}>({entry.rankCount} {entry.rankCount === 1 ? 'liste' : 'listes'})</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function RankTopicPage({
  topicSlug, topicEmoji, topicTitle, topicBadge,
  entries, userEntryLists, currentUserId, isLoggedIn,
}: {
  topicSlug: string
  topicEmoji: string
  topicTitle: string
  topicBadge: string
  entries: Entry[]
  userEntryLists: UserEntryListData[]
  currentUserId: string | null
  isLoggedIn: boolean
}) {
  const { lang } = useParams() as { lang: string }
  const dict = getDict(lang)
  const t = dict.rank
  const boundAddEntry = addEntry.bind(null, topicSlug)
  const [state, formAction, pending] = useActionState(boundAddEntry, null)
  const [showForm, setShowForm] = useState(false)

  const sorted = [...entries].sort((a, b) => {
    if (a.avgRank === null && b.avgRank === null) return 0
    if (a.avgRank === null) return 1
    if (b.avgRank === null) return -1
    return a.avgRank - b.avgRank || b.rankCount - a.rankCount
  })
  const entryItems = entries.map(e => ({ id: e.id, title: e.title, year: e.year }))

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 60px' }}>

      {/* Header */}
      <div style={{ padding: '32px 0 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <Link href={`/${lang}/rank`} style={{ fontSize: 12, color: 'var(--fg-7)', textDecoration: 'none' }}>
            {lang === 'fr' ? 'Classer' : 'Rank'}
          </Link>
          <span style={{ color: 'var(--fg-9)' }}>/</span>
          <span style={{ fontSize: 12, color: 'var(--fg-5)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 9px' }}>{topicBadge}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 38 }}>{topicEmoji}</span>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 900, color: 'var(--fg)', letterSpacing: -1, lineHeight: 1 }}>{topicTitle}</h1>
            </div>
            <Link href={`/${lang}/topics/${topicSlug}`} style={{ fontSize: 12, color: 'var(--fg-6)', textDecoration: 'none' }}>
              {t.learnMore} →
            </Link>
          </div>
          {isLoggedIn && (
            <button onClick={() => setShowForm(v => !v)} style={{
              padding: '8px 16px', borderRadius: 8,
              border: showForm ? 'none' : '1px solid var(--border)',
              background: showForm ? 'var(--bg-subtle)' : 'none',
              color: showForm ? 'var(--fg-5)' : 'var(--fg-4)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}>
              {showForm ? t.cancel : `+ ${t.addEntry}`}
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ marginTop: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '20px 24px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-6)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>{t.addEntryTitle}</p>
            {state?.error && (
              <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, color: 'var(--error-text)', fontSize: 13 }}>{state.error}</div>
            )}
            <form action={formAction} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 180px' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-6)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
                <input name="title" required style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-6)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.yearLabel}</label>
                <input name="year" type="number" min={1888} max={2099} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: '2 1 180px' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-6)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t.coverLabel} <span style={{ color: 'var(--fg-9)', textTransform: 'none', letterSpacing: 0 }}>{t.coverOptional}</span>
                </label>
                <input name="cover" type="url" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', color: 'var(--fg)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <button type="submit" disabled={pending} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 13, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1, flexShrink: 0 }}>
                {pending ? t.submitting : t.submit}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Personal rankings */}
      <div style={{ padding: '28px 0 0' }}>
        <UserEntryListSection
          topicSlug={topicSlug}
          topicTitle={topicTitle}
          entries={entryItems}
          userEntryLists={userEntryLists}
          currentUserId={currentUserId}
          isLoggedIn={isLoggedIn}
          t={dict.rankings}
        />
      </div>

      {/* Community ranking */}
      <div style={{ paddingTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>{t.communityRanking}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        {sorted.length === 0 ? (
          <p style={{ color: 'var(--fg-7)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{t.noEntries}</p>
        ) : (
          <div>
            {sorted.map((entry, i) => (
              <EntryRow key={entry.id} entry={entry} rank={i + 1} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
