'use client'

import React, { use, useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { fetchAllRankEntries } from '@/app/actions/rankEntries'
import { type UserEntryListData } from './UserEntryListSection'
import type { RankEntry, CommunityEntries } from '@/lib/communityRankData'
import { combinedScore } from '@/lib/communityRankScore'
import { pickTitle } from '@/lib/i18n'
import Link from 'next/link'

const TIERS = ['EX', 'TB', 'BO', 'AB', 'PA', 'IN', 'MA']
const TIER_LABEL: Record<string, string> = {
  EX: 'Excellent', TB: 'Très bon', BO: 'Bon', AB: 'Assez bien', PA: 'Passable', IN: 'Insuffisant', MA: 'Mauvais',
}
const TIER_COLOR: Record<string, string> = {
  EX: '#5b8dee', TB: '#388e3c', BO: '#66bb6a', AB: '#a3c940', PA: '#f9c933', IN: '#f5a623', MA: '#e05555',
}

type SortMode = 'combined' | 'tier' | 'rank' | 'favorite' | 'popular'

type Entry = RankEntry

type ListItemData = {
  entryId: string
  position: number | null
  tier: string | null
  note: string | null
  entry: { id: string; title: string; year: number | null; cover: string | null }
}

export type PersonalRankData = {
  userLists: UserEntryListData[]
  currentUserId: string | null
  isLoggedIn: boolean
}

function QuickAddPanel({
  entry,
  myTierList,
  onAdd,
  onToggleRanking,
  onClose,
}: {
  entry: Entry
  myTierList: UserEntryListData | null
  onAdd: (tier: string, insertBeforeId?: string) => Promise<void>
  onToggleRanking: (tier: string) => Promise<void>
  onClose: () => void
}) {
  const { lang } = useParams() as { lang: string }
  const rankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
  const currentTierOfEntry = myTierList?.items.find(i => i.entryId === entry.id)?.tier ?? null

  const [selectedTier, setSelectedTier] = useState<string | null>(currentTierOfEntry)
  const [insertBefore, setInsertBefore] = useState<string | 'end'>('end')
  const [isPending, setIsPending] = useState(false)

  const isRanked = selectedTier ? rankedTiers.includes(selectedTier) : false
  const currentTierItems: ListItemData[] = selectedTier
    ? (myTierList?.items ?? [])
        .filter(i => i.tier === selectedTier && i.entryId !== entry.id)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    : []

  async function handleConfirm() {
    if (!selectedTier) return
    setIsPending(true)
    await onAdd(selectedTier, isRanked && insertBefore !== 'end' ? insertBefore : undefined)
  }

  return (
    <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', marginBottom: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--fg-5)', marginBottom: 10 }}>
        Ajouter à ma liste : <span style={{ color: 'var(--fg-2)', fontWeight: 600 }}>{pickTitle(entry, lang)}</span>
        {currentTierOfEntry && (
          <span style={{ marginLeft: 8, fontSize: 11, color: TIER_COLOR[currentTierOfEntry], fontStyle: 'italic' }}>
            (actuellement en {TIER_LABEL[currentTierOfEntry]})
          </span>
        )}
      </div>

      {/* Tier selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TIERS.map(tier => {
          const c = TIER_COLOR[tier]
          const isSelected = selectedTier === tier
          return (
            <button
              key={tier}
              onClick={() => { setSelectedTier(tier); setInsertBefore('end') }}
              style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 11,
                border: `1px solid ${isSelected ? c : c + '55'}`,
                background: isSelected ? `${c}22` : 'none',
                color: c,
                outline: isSelected ? `2px solid ${c}44` : 'none',
                transition: 'all .1s',
              }}
            >
              {TIER_LABEL[tier]}
            </button>
          )
        })}
      </div>

      {/* Mode toggle for the selected tier (only on existing lists) */}
      {selectedTier && myTierList && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-6)' }}>
            Mode pour {TIER_LABEL[selectedTier]} :
          </span>
          <div role="group" aria-label="Mode du tier" style={{ display: 'flex', borderRadius: 7, border: `1px solid ${isRanked ? 'var(--accent-muted)' : 'var(--border)'}`, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-subtle)' }}>
            <button
              onClick={() => isRanked && onToggleRanking(selectedTier)}
              title="Films groupés sans ordre dans cette mention"
              style={{ padding: '4px 9px', border: 'none', background: !isRanked ? 'var(--bg-card)' : 'transparent', color: !isRanked ? 'var(--fg-3)' : 'var(--fg-6)', fontSize: 10.5, fontWeight: !isRanked ? 700 : 500, cursor: !isRanked ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span aria-hidden style={{ fontSize: 11, opacity: 0.85 }}>▦</span>
              Vrac
            </button>
            <button
              onClick={() => !isRanked && onToggleRanking(selectedTier)}
              title="Classer les films par rang (1, 2, 3…) dans cette mention"
              style={{ padding: '4px 9px', border: 'none', borderLeft: '1px solid var(--border)', background: isRanked ? 'var(--accent-fg)' : 'transparent', color: isRanked ? 'var(--btn-text)' : 'var(--fg-6)', fontSize: 10.5, fontWeight: isRanked ? 800 : 500, cursor: isRanked ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span aria-hidden style={{ fontFamily: "'Fraunces', serif", fontWeight: 800 }}>1·2·3</span>
              <span style={{ fontWeight: 600 }}>Classé</span>
            </button>
          </div>
        </div>
      )}

      {/* Position picker for ranked tiers */}
      {isRanked && selectedTier && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-6)', marginBottom: 4 }}>
            Position dans {TIER_LABEL[selectedTier]} :
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: insertBefore === 'end' ? 'var(--fg-2)' : 'var(--fg-6)', padding: '3px 0' }}>
            <input type="radio" name="pos" checked={insertBefore === 'end'} onChange={() => setInsertBefore('end')} style={{ accentColor: TIER_COLOR[selectedTier] }} />
            En dernier ({currentTierItems.length + 1}e)
          </label>
          {currentTierItems.map((item, idx) => (
            <label key={item.entryId} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: insertBefore === item.entryId ? 'var(--fg-2)' : 'var(--fg-6)', padding: '3px 0' }}>
              <input type="radio" name="pos" checked={insertBefore === item.entryId} onChange={() => setInsertBefore(item.entryId)} style={{ accentColor: TIER_COLOR[selectedTier] }} />
              Avant « {pickTitle(item.entry, lang)} » (#{idx + 1})
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={handleConfirm}
          disabled={!selectedTier || isPending}
          style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'var(--btn)', color: 'var(--btn-text)', fontSize: 12, fontFamily: 'inherit', cursor: selectedTier && !isPending ? 'pointer' : 'not-allowed', opacity: selectedTier && !isPending ? 1 : 0.5 }}
        >
          {isPending ? 'Ajout…' : currentTierOfEntry ? 'Déplacer' : 'Ajouter'}
        </button>
        <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-6)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function majorityTier(distribution: Record<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const tier of TIERS) {
    const c = distribution[tier] ?? 0
    if (c > bestCount) { best = tier; bestCount = c }
  }
  return best
}

function buildTierGradient(distribution: Record<string, number>, total: number): string | null {
  if (total === 0) return null
  const stops: string[] = []
  let cum = 0
  for (const tier of TIERS) {
    const count = distribution[tier] ?? 0
    if (count === 0) continue
    const pct = (count / total) * 100
    stops.push(`${TIER_COLOR[tier]} ${cum.toFixed(2)}% ${(cum + pct).toFixed(2)}%`)
    cum += pct
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

function TableHeader() {
  return (
    <div className="rank-header" style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
      color: 'var(--fg-6)', fontWeight: 600,
    }}>
      <span className="col-rank" style={{ textAlign: 'center' }}>#</span>
      <span className="col-poster" />
      <span className="col-title">Titre</span>
      <div className="col-metrics">
        <span className="col-mention" style={{ textAlign: 'center' }}>Mention</span>
        <span className="col-avg" style={{ textAlign: 'center' }}>Rang moyen</span>
        <span className="col-fav" style={{ textAlign: 'center' }}>En tête</span>
      </div>
      <span className="col-action" />
    </div>
  )
}

function EntryRow({ entry, rank, isLoggedIn, myTier, isOpen, onAdd }: {
  entry: Entry
  rank: number
  isLoggedIn: boolean
  myTier: string | null
  isOpen: boolean
  onAdd: () => void
}) {
  const { lang } = useParams() as { lang: string }
  const displayTitle = pickTitle(entry, lang)
  const isTop3 = rank <= 3
  const myTierColor = myTier ? TIER_COLOR[myTier] : null
  const totalVotes = Object.values(entry.tierDistribution).reduce((s, n) => s + n, 0)
  const mention = majorityTier(entry.tierDistribution)
  const tierGradient = buildTierGradient(entry.tierDistribution, totalVotes)

  return (
    <div className="rank-row" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, cursor: 'default',
      borderBottomColor: isOpen ? 'transparent' : undefined,
      borderBottomLeftRadius: isOpen ? 0 : 10,
      borderBottomRightRadius: isOpen ? 0 : 10,
    }}>
      {/* Rank */}
      <span className="col-rank" style={{
        fontFamily: "'Fraunces', serif",
        fontSize: rank === 1 ? 17 : isTop3 ? 15 : 14,
        fontWeight: rank === 1 ? 700 : 400,
        color: isTop3 ? 'var(--fg)' : 'var(--fg-5)',
        textAlign: 'center', lineHeight: 1,
      }}>{rank}</span>

      {/* Poster */}
      {entry.cover
        ? <img className="col-poster" src={entry.cover} alt={displayTitle} loading="lazy" style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
        : <div className="col-poster" style={{ width: 44, height: 60, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }} />
      }

      {/* Title */}
      <div className="col-title" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayTitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {entry.year && <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>{entry.year}</span>}
          {myTierColor && myTier && (
            <span title="Ma note" style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: `${myTierColor}18`, color: myTierColor }}>
              ma note · {TIER_LABEL[myTier]}
            </span>
          )}
        </div>
      </div>

      <div className="col-metrics">
        {/* Mention */}
        <div className="col-mention" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3, minWidth: 0 }}>
          {mention && tierGradient ? (
            <>
              <div
                title={TIERS.filter(t => entry.tierDistribution[t]).map(t => `${TIER_LABEL[t]} : ${entry.tierDistribution[t]}`).join(' · ')}
                style={{ position: 'relative', height: 26, borderRadius: 6, background: tierGradient, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.12)', overflow: 'hidden' }}
              >
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 13, fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.55), 0 0 6px rgba(0,0,0,.25)', letterSpacing: '.01em' }}>
                  {TIER_LABEL[mention]}
                </span>
              </div>
              <span style={{ fontSize: 9.5, color: 'var(--fg-6)', textAlign: 'center', letterSpacing: '.02em' }}>{totalVotes} avis</span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--fg-7)', textAlign: 'center' }}>—</span>
          )}
        </div>

        {/* Rang moyen */}
        <div className="col-avg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {entry.avgRank !== null ? (
            <>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>#{entry.avgRank.toFixed(1)}</span>
              <span style={{ fontSize: 9.5, color: 'var(--fg-6)' }}>{entry.rankCount} cl.</span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--fg-7)' }}>—</span>
          )}
        </div>

        {/* En tête */}
        <div className="col-fav" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {entry.favoriteCount > 0 ? (
            <>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-5)' }}>★</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{entry.favoriteCount}</span>
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--fg-6)' }}>liste{entry.favoriteCount > 1 ? 's' : ''}</span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--fg-7)' }}>—</span>
          )}
        </div>
      </div>

      {/* Action */}
      {isLoggedIn ? (
        <button
          onClick={onAdd}
          title={myTier ? 'Modifier' : 'Ajouter à ma liste'}
          className="col-action"
          style={{
            width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
            background: myTier ? 'transparent' : 'var(--bg-subtle)',
            border: `1px solid ${isOpen ? 'var(--fg-3)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: myTier ? 13 : 18, color: isOpen ? 'var(--fg)' : 'var(--fg-4)',
            justifySelf: 'end',
          }}
        >
          {myTier ? '✎' : (isOpen ? '×' : '+')}
        </button>
      ) : (
        <Link
          href={`/${lang}/auth/login`}
          title={lang === 'fr' ? 'Connecte-toi pour noter' : 'Sign in to rate'}
          className="col-action"
          style={{
            width: 28, height: 28, borderRadius: 7, textDecoration: 'none',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'var(--fg-4)',
            justifySelf: 'end',
          }}
        >
          +
        </Link>
      )}
    </div>
  )
}

// Resolves user lists promise and renders entry rows with user-specific data (my tier badges, quick add)
function UserAwareEntryList({
  personalDataPromise,
  entries,
  topicSlug,
  quickAddId,
  setQuickAddId,
}: {
  personalDataPromise: Promise<PersonalRankData>
  entries: Entry[]
  topicSlug: string
  quickAddId: string | null
  setQuickAddId: (id: string | null) => void
}) {
  const { userLists: initialLists, currentUserId, isLoggedIn } = use(personalDataPromise)
  const [lists, setLists] = useState(initialLists)
  const myTierList = lists.find(l => l.userId === currentUserId && (l.type === 'TIER' || l.type === 'BOTH')) ?? null

  async function handleQuickAdd(entryId: string, tier: string, insertBeforeId?: string) {
    const currentItems = myTierList?.items ?? []
    const rankedTiers = (myTierList?.rankedTiers ?? '').split(',').filter(Boolean)
    const withoutEntry = currentItems.filter(i => i.entryId !== entryId)
    const isRanked = rankedTiers.includes(tier)

    let newItems: Array<{ entryId: string; tier?: string; position?: number }>

    if (isRanked) {
      const tierItems = withoutEntry
        .filter(i => i.tier === tier)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      const insertIdx = insertBeforeId ? tierItems.findIndex(i => i.entryId === insertBeforeId) : -1
      const actualIdx = insertIdx === -1 ? tierItems.length : insertIdx
      const newTierItems = [
        ...tierItems.slice(0, actualIdx),
        { entryId, tier, position: 0 },
        ...tierItems.slice(actualIdx),
      ].map((item, i) => ({ entryId: item.entryId, tier: item.tier ?? undefined, position: i + 1 }))
      newItems = [
        ...withoutEntry.filter(i => i.tier !== tier).map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined })),
        ...newTierItems,
      ]
    } else {
      newItems = [
        ...withoutEntry.map(i => ({ entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined })),
        { entryId, tier },
      ]
    }

    const updated = await saveUserEntryLists(topicSlug, [], newItems, rankedTiers)
    setLists(prev => [...prev.filter(l => l.userId !== currentUserId), ...updated])
    setQuickAddId(null)
  }

  async function handleToggleRanking(tier: string) {
    if (!myTierList) return
    const currentRankedTiers = (myTierList.rankedTiers ?? '').split(',').filter(Boolean)
    const willBeRanked = !currentRankedTiers.includes(tier)
    const newRankedTiers = willBeRanked
      ? [...currentRankedTiers, tier].sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b))
      : currentRankedTiers.filter(t => t !== tier)

    let pos = 1
    const newItems = myTierList.items.map(i => {
      if (i.tier !== tier) {
        return { entryId: i.entryId, tier: i.tier ?? undefined, position: i.position ?? undefined, note: i.note ?? undefined }
      }
      return {
        entryId: i.entryId,
        tier: i.tier ?? undefined,
        position: willBeRanked ? pos++ : undefined,
        note: i.note ?? undefined,
      }
    })

    const updated = await saveUserEntryLists(topicSlug, [], newItems, newRankedTiers)
    setLists(prev => [...prev.filter(l => l.userId !== currentUserId), ...updated])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <TableHeader />
      {entries.map((entry, i) => (
        <React.Fragment key={entry.id}>
          <EntryRow
            entry={entry}
            rank={i + 1}
            isLoggedIn={isLoggedIn}
            myTier={myTierList?.items.find(item => item.entryId === entry.id)?.tier ?? null}
            isOpen={quickAddId === entry.id}
            onAdd={() => setQuickAddId(quickAddId === entry.id ? null : entry.id)}
          />
          {quickAddId === entry.id && (
            <QuickAddPanel
              entry={entry}
              myTierList={myTierList}
              onAdd={(tier, insertBeforeId) => handleQuickAdd(entry.id, tier, insertBeforeId)}
              onToggleRanking={handleToggleRanking}
              onClose={() => setQuickAddId(null)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export function CommunityListSkeleton() {
  return (
    <>
      <div style={{ display: 'flex', gap: 2, paddingBottom: 12, flexWrap: 'wrap' }}>
        {(['combined', 'tier', 'rank', 'favorite', 'popular'] as const).map(mode => (
          <div key={mode} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13,
            border: '1px solid transparent', color: 'var(--fg-5)',
          }}>
            {mode === 'combined' ? 'Combiné' : mode === 'tier' ? 'Mention' : mode === 'rank' ? 'Rang' : mode === 'favorite' ? 'Favoris' : 'Popularité'}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            height: 90, background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, opacity: 0.5,
          }} />
        ))}
      </div>
    </>
  )
}

export function RankCommunityBody({
  topicSlug,
  entriesPromise,
  personalDataPromise,
}: {
  topicSlug: string
  entriesPromise: Promise<CommunityEntries | null>
  personalDataPromise: Promise<PersonalRankData>
}) {
  const { lang } = useParams() as { lang: string }
  const dict = getDict(lang)
  const t = dict.rank
  const data = use(entriesPromise)
  const initialEntries = data?.initialEntries ?? []
  const totalEntries = data?.totalEntries ?? 0

  const [sortMode, setSortMode] = useState<SortMode>('combined')
  const [quickAddId, setQuickAddId] = useState<string | null>(null)
  const [displayCount, setDisplayCount] = useState(100)
  const [allEntries, setAllEntries] = useState(initialEntries)
  const [isLoadingFull, setIsLoadingFull] = useState(initialEntries.length < totalEntries)

  useEffect(() => {
    if (!isLoadingFull) return
    fetchAllRankEntries(topicSlug, lang).then(entries => {
      setAllEntries(entries)
      setIsLoadingFull(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = [...allEntries].sort((a, b) => {
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
    if (sortMode === 'popular') {
      return b.tierCount - a.tierCount || (b.avgTierScore ?? 0) - (a.avgTierScore ?? 0)
    }
    return combinedScore(b) - combinedScore(a)
  })

  const visibleEntries = sorted.slice(0, displayCount)

  return (
    <>
      <div style={{ display: 'flex', gap: 2, paddingBottom: 12, flexWrap: 'wrap' }}>
        {(['combined', 'tier', 'rank', 'favorite', 'popular'] as SortMode[]).map(mode => (
          <button key={mode} onClick={() => { setSortMode(mode); setDisplayCount(100) }} style={{
            padding: '6px 14px', borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer', fontSize: 13,
            border: sortMode === mode ? '1px solid var(--border)' : '1px solid transparent',
            background: sortMode === mode ? 'var(--bg-card)' : 'transparent',
            color: sortMode === mode ? 'var(--fg)' : 'var(--fg-5)',
            fontWeight: sortMode === mode ? 500 : 400,
          }}>
            {mode === 'combined' ? 'Combiné' : mode === 'tier' ? 'Mention' : mode === 'rank' ? 'Rang' : mode === 'favorite' ? 'Favoris' : 'Popularité'}
          </button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <p style={{ color: 'var(--fg-5)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{t.noEntries}</p>
      ) : (
        <>
          <Suspense
            fallback={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <TableHeader />
                {visibleEntries.map((entry, i) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    rank={i + 1}
                    isLoggedIn={false}
                    myTier={null}
                    isOpen={false}
                    onAdd={() => {}}
                  />
                ))}
              </div>
            }
          >
            <UserAwareEntryList
              personalDataPromise={personalDataPromise}
              entries={visibleEntries}
              topicSlug={topicSlug}
              quickAddId={quickAddId}
              setQuickAddId={setQuickAddId}
            />
          </Suspense>
          {isLoadingFull && sorted.length <= displayCount && (
            <div style={{ width: '100%', marginTop: 16, padding: '12px', textAlign: 'center', color: 'var(--fg-6)', fontSize: 12 }}>
              Chargement des éléments suivants…
            </div>
          )}
          {!isLoadingFull && sorted.length > displayCount && (
            <button
              onClick={() => setDisplayCount(c => c + 100)}
              style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-5)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Voir plus ({sorted.length - displayCount} restants)
            </button>
          )}
        </>
      )}
    </>
  )
}

