'use client'

import { useActionState, useState } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { addEntry } from '@/app/actions/entries'
import { UserEntryListSection, type UserEntryListData } from './UserEntryListSection'
import Link from 'next/link'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#5b8dee', TB: '#388e3c', BO: '#66bb6a', AB: '#a3c940', PA: '#f9c933', IN: '#f5a623', MA: '#e05555',
}

function scoreTierLabel(score: number): string {
  const rounded = Math.round(score)
  return { 7: 'EX', 6: 'TB', 5: 'BO', 4: 'AB', 3: 'PA', 2: 'IN', 1: 'MA' }[rounded] ?? 'AB'
}

type SortMode = 'combined' | 'tier' | 'rank' | 'favorite'

type Entry = {
  id: string
  title: string
  year: number | null
  cover: string | null
  avgRank: number | null
  rankCount: number
  avgTierScore: number | null
  tierCount: number
  favoriteCount: number
}

function EntryRow({ entry, rank, sortMode }: { entry: Entry; rank: number; sortMode: SortMode }) {
  const isTop3 = rank <= 3
  const tierLabel = entry.avgTierScore !== null ? scoreTierLabel(entry.avgTierScore) : null
  const color = tierLabel ? TIER_COLOR[tierLabel] : 'var(--fg-8)'

  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, lineHeight: 1,
        color: isTop3 ? 'var(--accent-fg)' : 'var(--fg-8)',
        width: 30, flexShrink: 0, textAlign: 'right', paddingTop: 3,
      }}>{rank}</span>

      {entry.cover
        ? <img src={entry.cover} alt={entry.title} style={{ width: 38, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.12)' }} />
        : <div style={{ width: 38, height: 54, borderRadius: 4, background: 'var(--bg-subtle)', flexShrink: 0 }} />
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.2 }}>{entry.title}</span>
          {entry.year && <span style={{ fontSize: 12, color: 'var(--fg-7)' }}>{entry.year}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Tier badge */}
          {tierLabel && (
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: "'Fraunces', serif",
              color, background: `${color}18`, border: `1px solid ${color}44`,
              borderRadius: 5, padding: '2px 8px',
              outline: sortMode === 'tier' ? `2px solid ${color}66` : 'none',
            }}>
              {TIER_LABEL[tierLabel]}
              <span style={{ fontFamily: 'inherit', fontWeight: 400, fontSize: 10, color, opacity: 0.7 }}> ×{entry.tierCount}</span>
            </span>
          )}

          {/* Rang moyen */}
          {entry.avgRank !== null && (
            <span style={{
              fontSize: 11, color: 'var(--fg-6)',
              background: 'var(--bg-subtle)', border: `1px solid var(--border)`,
              borderRadius: 5, padding: '2px 8px',
              outline: sortMode === 'rank' ? '2px solid var(--accent-muted)' : 'none',
            }}>
              rang <span style={{ fontWeight: 600, color: 'var(--fg-3)' }}>#{entry.avgRank.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: 'var(--fg-8)' }}> /{entry.rankCount}</span>
            </span>
          )}

          {/* Favoris */}
          {entry.favoriteCount > 0 && (
            <span style={{
              fontSize: 11, color: 'var(--fg-6)',
              background: 'var(--bg-subtle)', border: `1px solid var(--border)`,
              borderRadius: 5, padding: '2px 8px',
              outline: sortMode === 'favorite' ? '2px solid var(--accent-muted)' : 'none',
            }}>
              ★ <span style={{ fontWeight: 600, color: 'var(--fg-3)' }}>{entry.favoriteCount}</span> fav
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
  const [sortMode, setSortMode] = useState<SortMode>('combined')

  const sorted = [...entries].sort((a, b) => {
    const hasA = a.avgTierScore !== null || a.avgRank !== null || a.favoriteCount > 0
    const hasB = b.avgTierScore !== null || b.avgRank !== null || b.favoriteCount > 0
    if (!hasA && !hasB) return 0
    if (!hasA) return 1
    if (!hasB) return -1

    if (sortMode === 'tier') {
      if (a.avgTierScore === null && b.avgTierScore === null) return 0
      if (a.avgTierScore === null) return 1
      if (b.avgTierScore === null) return -1
      return b.avgTierScore - a.avgTierScore || (a.avgRank ?? 999) - (b.avgRank ?? 999)
    }
    if (sortMode === 'rank') {
      if (a.avgRank === null && b.avgRank === null) return (b.avgTierScore ?? 0) - (a.avgTierScore ?? 0)
      if (a.avgRank === null) return 1
      if (b.avgRank === null) return -1
      return a.avgRank - b.avgRank
    }
    if (sortMode === 'favorite') {
      return b.favoriteCount - a.favoriteCount || (b.avgTierScore ?? 0) - (a.avgTierScore ?? 0)
    }
    // combined: tier score weighted + rank bonus + favorite bonus
    const scoreA = (a.avgTierScore ?? 0) * 4 + (a.avgRank ? 1 / a.avgRank * 8 : 0) + a.favoriteCount
    const scoreB = (b.avgTierScore ?? 0) * 4 + (b.avgRank ? 1 / b.avgRank * 8 : 0) + b.favoriteCount
    return scoreB - scoreA
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--fg-6)', whiteSpace: 'nowrap' }}>{t.communityRanking}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          {(['combined', 'tier', 'rank', 'favorite'] as SortMode[]).map(mode => (
            <button key={mode} onClick={() => setSortMode(mode)} style={{
              padding: '4px 11px', borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11,
              border: `1px solid ${sortMode === mode ? 'var(--accent-muted)' : 'var(--border)'}`,
              background: sortMode === mode ? 'var(--accent-faint)' : 'none',
              color: sortMode === mode ? 'var(--accent-fg)' : 'var(--fg-6)',
              transition: 'all .12s',
            }}>
              {mode === 'combined' ? 'Combiné' : mode === 'tier' ? 'Tier' : mode === 'rank' ? 'Rang' : 'Favoris'}
            </button>
          ))}
        </div>
        {sorted.length === 0 ? (
          <p style={{ color: 'var(--fg-7)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{t.noEntries}</p>
        ) : (
          <div>
            {sorted.map((entry, i) => (
              <EntryRow key={entry.id} entry={entry} rank={i + 1} sortMode={sortMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
