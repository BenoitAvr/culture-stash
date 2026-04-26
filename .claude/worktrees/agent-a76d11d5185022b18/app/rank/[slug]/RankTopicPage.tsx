'use client'

import { useActionState, useTransition, useState } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { addEntry, saveUserEntry } from '@/app/actions/entries'
import { UserEntryListSection, type UserEntryListData } from './UserEntryListSection'
import Link from 'next/link'

type Entry = {
  id: string
  title: string
  year: number | null
  cover: string | null
  avgRank: number | null
  rankCount: number
  userStars: number | null
  userNote: string | null
}

function StarPicker({ value, onChange }: { value: number | null; onChange: (s: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 1px', fontSize: 20, color: s <= (hover ?? value ?? 0) ? '#c8f55a' : '#2a2a2a', transition: 'color .1s' }}>
          ★
        </button>
      ))}
    </span>
  )
}

function EntryRow({ entry, rank, showStars, isLoggedIn, t }: { entry: Entry; rank: number; showStars: boolean; isLoggedIn: boolean; t: ReturnType<typeof getDict>['rank'] }) {
  const [isPending, startTransition] = useTransition()
  const [editingNote, setEditingNote] = useState(false)
  const [noteVal, setNoteVal] = useState(entry.userNote ?? '')

  function handleStars(stars: number) {
    startTransition(async () => { await saveUserEntry(entry.id, stars, entry.userNote) })
  }
  function handleSaveNote() {
    startTransition(async () => { await saveUserEntry(entry.id, entry.userStars, noteVal.trim() || null) })
    setEditingNote(false)
  }

  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #1a1a1a', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: '#2a2a2a', width: 28, flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>{rank}</span>
      {entry.cover
        ? <img src={entry.cover} alt={entry.title} style={{ width: 46, height: 64, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
        : <div style={{ width: 46, height: 64, borderRadius: 5, background: '#1a1a1a', flexShrink: 0 }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700, color: '#f0f0f0' }}>{entry.title}</span>
          {entry.year && <span style={{ fontSize: 12, color: '#444' }}>{entry.year}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {entry.avgRank !== null ? (
            <>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 700, color: '#c8f55a' }}>#{entry.avgRank.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#444' }}>{entry.rankCount} {entry.rankCount === 1 ? 'liste' : 'listes'}</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#333' }}>—</span>
          )}
          {showStars && isLoggedIn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: isPending ? 0.5 : 1, marginLeft: 8 }}>
              <StarPicker value={entry.userStars} onChange={handleStars} />
            </div>
          )}
        </div>
        {isLoggedIn && (
          <div style={{ marginTop: 6 }}>
            {editingNote ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder={t.yourNote}
                  style={{ flex: 1, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, padding: '5px 10px', color: '#f0f0f0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={handleSaveNote} disabled={isPending} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#c8f55a', color: '#0e0e0e', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t.saveNote}</button>
                <button onClick={() => { setEditingNote(false); setNoteVal(entry.userNote ?? '') }} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setEditingNote(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: entry.userNote ? '#777' : '#333', textAlign: 'left', fontFamily: 'inherit' }}>
                {entry.userNote ? `"${entry.userNote}"` : t.yourNote}
              </button>
            )}
          </div>
        )}
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
  const [showStars, setShowNotes] = useState(false)

  const sorted = [...entries].sort((a, b) => {
    if (a.avgRank === null && b.avgRank === null) return 0
    if (a.avgRank === null) return 1
    if (b.avgRank === null) return -1
    return a.avgRank - b.avgRank || b.rankCount - a.rankCount
  })
  const entryItems = entries.map(e => ({ id: e.id, title: e.title, year: e.year }))

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ padding: '28px 0 24px', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Link href={`/${lang}/rank`} style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>{lang === 'fr' ? 'Classer' : 'Rank'}</Link>
          <span style={{ color: '#2a2a2a' }}>/</span>
          <span style={{ fontSize: 12, color: '#555' }}>{topicBadge}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 34 }}>{topicEmoji}</span>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: '#f0f0f0', letterSpacing: -1 }}>{topicTitle}</h1>
            </div>
            <Link href={`/${lang}/topics/${topicSlug}`} style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>{t.learnMore}</Link>
          </div>
          {isLoggedIn && (
            <button onClick={() => setShowForm(v => !v)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2a2a2a', background: showForm ? '#2a2a2a' : 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              {showForm ? t.cancel : t.addEntry}
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ marginTop: 20, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 10, padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.addEntryTitle}</p>
            {state?.error && <div style={{ background: '#2a1515', border: '1px solid #5a2020', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#f57c7c', fontSize: 13 }}>{state.error}</div>}
            <form action={formAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 180px' }}>
                <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.titleLabel}</label>
                <input name="title" required style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 7, padding: '8px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.yearLabel}</label>
                <input name="year" type="number" min={1888} max={2099} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 7, padding: '8px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: '2 1 180px' }}>
                <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.coverLabel} <span style={{ color: '#333', textTransform: 'none', letterSpacing: 0 }}>{t.coverOptional}</span></label>
                <input name="cover" type="url" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 7, padding: '8px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <button type="submit" disabled={pending} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#c8f55a', color: '#0e0e0e', fontSize: 13, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1, flexShrink: 0 }}>
                {pending ? t.submitting : t.submit}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Classements personnels */}
      <div style={{ padding: '24px 0 0' }}>
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

      {/* Classement général */}
      <div style={{ padding: '32px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#777' }}>{t.communityRanking}</span>
          <div style={{ flex: 1, height: 1, background: '#2a2a2a' }} />
          {isLoggedIn && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={showStars} onChange={e => setShowNotes(e.target.checked)} style={{ accentColor: '#c8f55a', cursor: 'pointer' }} />
              Étoiles
            </label>
          )}
        </div>
        {sorted.length === 0
          ? <p style={{ color: '#444', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>{t.noEntries}</p>
          : sorted.map((entry, i) => <EntryRow key={entry.id} entry={entry} rank={i + 1} showStars={showStars} isLoggedIn={isLoggedIn} t={t} />)
        }
      </div>
      <div style={{ height: 40 }} />
    </div>
  )
}
