'use client'

import React, { use, useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { getDict } from '@/dictionaries/client'
import { saveUserEntryLists } from '@/app/actions/entryLists'
import { fetchAllRankEntries } from '@/app/actions/rankEntries'
import { type UserEntryListData } from './UserEntryListSection'
import type { RankEntry, CommunityEntries } from '@/lib/communityRankData'
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
  onClose,
}: {
  entry: Entry
  myTierList: UserEntryListData | null
  onAdd: (tier: string, insertBeforeId?: string) => Promise<void>
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

function TierBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((s, n) => s + n, 0)
  if (total === 0) return null
  const segs = TIERS.filter(t => distribution[t])
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', width: 90, background: 'var(--border)', flexShrink: 0 }}>
      {segs.map(tier => (
        <div
          key={tier}
          title={`${TIER_LABEL[tier]} : ${distribution[tier]}`}
          style={{ flex: distribution[tier], background: TIER_COLOR[tier] }}
        />
      ))}
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
  const total = Object.values(entry.tierDistribution).reduce((s, n) => s + n, 0)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '28px 48px 1fr auto',
      alignItems: 'center', gap: 14, padding: '14px 16px',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, cursor: 'default',
      borderBottomColor: isOpen ? 'transparent' : undefined,
      borderBottomLeftRadius: isOpen ? 0 : 12,
      borderBottomRightRadius: isOpen ? 0 : 12,
    }}>
      {/* Rank */}
      <span style={{
        fontFamily: "'Fraunces', serif",
        fontSize: rank === 1 ? 17 : isTop3 ? 15 : 14,
        fontWeight: rank === 1 ? 700 : 400,
        color: isTop3 ? 'var(--fg)' : 'var(--fg-5)',
        textAlign: 'center', lineHeight: 1,
      }}>{rank}</span>

      {/* Poster */}
      {entry.cover
        ? <img src={entry.cover} alt={displayTitle} loading="lazy" style={{ width: 48, height: 62, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)', flexShrink: 0 }} />
        : <div style={{ width: 48, height: 62, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border)', flexShrink: 0 }} />
      }

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayTitle}</div>
        {entry.year && <div style={{ fontSize: 11, color: 'var(--fg-5)', marginTop: 2 }}>{entry.year}</div>}
        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <TierBar distribution={entry.tierDistribution} />
            {TIERS.filter(t => entry.tierDistribution[t]).map(t => (
              <span key={t} style={{
                fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
                background: `${TIER_COLOR[t]}18`, color: TIER_COLOR[t],
              }}>
                {TIER_LABEL[t]}{entry.tierDistribution[t] > 1 ? ` ${entry.tierDistribution[t]}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {(entry.avgRank !== null || entry.favoriteCount > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            {entry.avgRank !== null && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>#{entry.avgRank.toFixed(1)}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-5)', fontWeight: 300 }}>rang moyen</span>
                <span style={{ fontSize: 10, color: 'var(--fg-5)', fontWeight: 300, opacity: 0.6 }}>· {entry.rankCount} cl.</span>
              </div>
            )}
            {entry.favoriteCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--fg-5)' }}>★</span>
                <span style={{ fontSize: 11, color: 'var(--fg-5)', fontWeight: 300 }}>
                  en tête de {entry.favoriteCount} liste{entry.favoriteCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {myTierColor && myTier && (
          <>
            <div style={{ width: 1, height: 34, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9, color: 'var(--fg-5)', letterSpacing: '0.3px' }}>ma note</span>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 3, background: `${myTierColor}18`, color: myTierColor }}>
                {TIER_LABEL[myTier]}
              </span>
            </div>
          </>
        )}

        {isLoggedIn ? (
          <button
            onClick={onAdd}
            title={myTier ? 'Modifier' : 'Ajouter à ma liste'}
            style={{
              width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
              background: myTier ? 'transparent' : 'var(--bg-subtle)',
              border: `1px solid ${isOpen ? 'var(--fg-3)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: myTier ? 13 : 18, color: isOpen ? 'var(--fg)' : 'var(--fg-4)',
              flexShrink: 0,
            }}
          >
            {myTier ? '✎' : (isOpen ? '×' : '+')}
          </button>
        ) : (
          <Link
            href={`/${lang}/auth/login`}
            title={lang === 'fr' ? 'Connecte-toi pour noter' : 'Sign in to rate'}
            style={{
              width: 28, height: 28, borderRadius: 7, textDecoration: 'none',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'var(--fg-4)',
              flexShrink: 0,
            }}
          >
            +
          </Link>
        )}
      </div>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
    const scoreA = (a.avgTierScore ?? 0) * 4 + (a.avgRank ? 1 / a.avgRank * 12 : 0) + a.favoriteCount + a.tierCount * 0.2
    const scoreB = (b.avgTierScore ?? 0) * 4 + (b.avgRank ? 1 / b.avgRank * 12 : 0) + b.favoriteCount + b.tierCount * 0.2
    return scoreB - scoreA
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

