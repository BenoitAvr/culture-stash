'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { StarRating } from './StarRating'
import { LikeButton } from './LikeButton'
import { UserListsSection, type UserListData } from './UserListsSection'
import { getDict } from '@/dictionaries/client'
import { PersonalTopicNote } from './PersonalTopicNote'

type Concept = { id: string; name: string }
type Resource = {
  id: string; title: string; sub: string; type: string; emoji: string
  url: string | null; avgRating: number; ratingCount: number; userRating: number | null
}
type Note = {
  id: string; title: string; excerpt: string; createdAt: string
  likeCount: number; userHasLiked: boolean
  author: { name: string }; tags: { name: string }[]
}

const TYPE_COLOR: Record<string, string> = {
  video: '#7c6df0', livre: '#f5a623', cours: '#c8f55a',
  podcast: '#f57c7c', album: '#7c6df0', film: '#7c6df0',
}

const AVATAR_COLORS = ['#7c6df0', '#f5a623', '#c8f55a', '#f57c7c']

function relDate(iso: string, t: ReturnType<typeof getDict>['time']): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 36e5)
  const d = Math.floor(h / 24)
  const w = Math.floor(d / 7)
  const m = Math.floor(d / 30)
  if (h < 1) return t.justNow
  if (h < 24) return t.hoursAgo.replace('{h}', String(h))
  if (d < 7) return (d === 1 ? t.dayAgo : t.daysAgo).replace('{d}', String(d))
  if (w < 5) return t.weeksAgo.replace('{w}', String(w))
  return t.monthsAgo.replace('{m}', String(m))
}

export function TopicTabs({
  lang, prose, diffLevel, diffNote, concepts, related, resources, notes, userLists, currentUserId, slug, isLoggedIn, rankable, personalNoteContent,
}: {
  lang: string
  prose: string; diffLevel: number; diffNote: string
  concepts: Concept[]; related: Concept[]
  resources: Resource[]; notes: Note[]
  userLists: UserListData[]; currentUserId: string | null
  slug: string; isLoggedIn: boolean
  rankable: boolean
  personalNoteContent: string | null
}) {
  const dict = getDict(lang)
  const t = dict
  const [tab, setTab] = useState<'intro' | 'ranking' | 'notes'>('intro')
  const [filter, setFilter] = useState('all')
  const [forceNoteEdit, setForceNoteEdit] = useState(false)
  const [noteOpen, setNoteOpen] = useState(!!personalNoteContent)
  const [pinNote, setPinNote] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('kb_pin_note')
    const pinned = saved === null ? true : saved === '1'
    setPinNote(pinned)
    setNoteOpen(pinned && !!personalNoteContent)
  }, [])

  function togglePin() {
    const next = !pinNote
    setPinNote(next)
    localStorage.setItem('kb_pin_note', next ? '1' : '0')
    if (!next) setNoteOpen(false)
    else if (personalNoteContent) setNoteOpen(true)
  }

  const FILTERS = [
    { key: 'all', label: t.filters.all },
    { key: 'video', label: `🎬 ${t.filters.videos}` },
    { key: 'livre', label: `📚 ${t.filters.books}` },
    { key: 'cours', label: `🎓 ${t.filters.courses}` },
    { key: 'podcast', label: `🎙️ ${t.filters.podcasts}` },
    { key: 'album', label: `💿 ${t.filters.albums}` },
    { key: 'film', label: `🎞️ ${t.filters.films}` },
  ]

  const shown = filter === 'all' ? resources : resources.filter(r => r.type === filter)

  const sideCard = (title: string, children: React.ReactNode) => (
    <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: '#777', marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  )

  return (
    <>
      {/* Tab bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', borderBottom: '1px solid #2a2a2a', position: 'sticky', top: 53, zIndex: 40, background: '#0e0e0e' }}>
        <div style={{ display: 'flex' }}>
          {isLoggedIn && (
            <>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <button
                  onClick={() => {
                    if (noteOpen) { setNoteOpen(false) }
                    else { setNoteOpen(true); if (!personalNoteContent) setForceNoteEdit(true) }
                  }}
                  style={{
                    padding: '14px 10px 14px 20px', fontFamily: 'inherit', fontSize: 13, background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                    color: noteOpen ? (personalNoteContent ? '#c8f55a' : '#aaa') : '#555',
                    borderBottom: `2px solid ${noteOpen ? (personalNoteContent ? '#c8f55a44' : '#2a2a2a') : 'transparent'}`,
                    transition: 'color .15s',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: personalNoteContent ? '#c8f55a' : '#333', display: 'inline-block', flexShrink: 0 }} />
                  Ma note
                </button>
                <button
                  onClick={togglePin}
                  title={pinNote ? 'Ne plus afficher par défaut' : 'Toujours afficher'}
                  style={{
                    padding: '14px 14px 14px 2px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 10,
                    color: pinNote ? '#c8f55a66' : '#2a2a2a',
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = pinNote ? '#c8f55a' : '#444' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = pinNote ? '#c8f55a66' : '#2a2a2a' }}
                >
                  ●
                </button>
              </div>
              <div style={{ width: 1, background: '#1e1e1e', margin: '10px 0' }} />
            </>
          )}
          {([
            { key: 'intro', label: t.tabs.understand, dot: '#7c6df0' },
            { key: 'ranking', label: t.tabs.rankings, dot: '#c8f55a' },
            { key: 'notes', label: t.tabs.notesTab, dot: '#f5a623' },
          ] as const).map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              padding: '14px 22px', fontFamily: 'inherit', fontSize: 13, background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
              color: tab === tb.key ? '#f0f0f0' : '#555',
              borderBottom: `2px solid ${tab === tb.key ? '#c8f55a' : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tb.dot, display: 'inline-block' }} />
              {tb.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4 }}>
          {rankable && (
            <Link
              href={`/${lang}/rank/${slug}`}
              style={{
                padding: '8px 14px', fontFamily: 'inherit', fontSize: 13,
                color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                transition: 'color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#888' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
            >
              Classer
              <span style={{ fontSize: 11 }}>↗</span>
            </Link>
          )}
        </div>
      </div>

      {isLoggedIn && noteOpen && (
        <PersonalTopicNote
          topicSlug={slug}
          initialContent={personalNoteContent}
          forceEdit={forceNoteEdit}
          onEditStarted={() => setForceNoteEdit(false)}
        />
      )}

      {/* Comprendre */}
      {tab === 'intro' && (
        <div style={{ padding: '28px 0', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28 }}>
          <div className="prose-content" dangerouslySetInnerHTML={{ __html: prose }} />
          <div>
            {sideCard(t.sidebar.concepts, (
              <div>{concepts.map(c => (
                <span key={c.id} style={{ display: 'inline-block', padding: '4px 11px', borderRadius: 20, background: '#242424', border: '1px solid #2a2a2a', fontSize: 12, margin: 3, color: '#ccc' }}>{c.name}</span>
              ))}</div>
            ))}
            {sideCard(t.sidebar.complexity, (
              <>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i < diffLevel ? '#c8f55a' : '#2a2a2a' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#777' }}>{t.sidebar.beginner}</span>
                  <span style={{ fontSize: 11, color: '#777' }}>{t.sidebar.expert}</span>
                </div>
                <p style={{ color: '#777', fontSize: 12, marginTop: 10 }}>{diffNote}</p>
              </>
            ))}
            {sideCard(t.sidebar.related, (
              <div>{related.map(r => (
                <span key={r.id} style={{ display: 'inline-block', padding: '4px 11px', borderRadius: 20, background: '#242424', border: '1px solid #2a2a2a', fontSize: 12, margin: 3, color: '#ccc' }}>{r.name}</span>
              ))}</div>
            ))}
          </div>
        </div>
      )}

      {/* Classements */}
      {tab === 'ranking' && (
        <div style={{ padding: '28px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 14px', borderRadius: 20, fontFamily: 'inherit', fontSize: 12,
                border: `1px solid ${filter === f.key ? '#c8f55a' : '#2a2a2a'}`,
                background: filter === f.key ? '#c8f55a' : 'none',
                color: filter === f.key ? '#0e0e0e' : '#777',
                fontWeight: filter === f.key ? 600 : 400,
                cursor: 'pointer', transition: 'all .15s',
              }}>{f.label}</button>
            ))}
          </div>

          {isLoggedIn && (
            <div style={{ marginBottom: 18 }}>
              <Link href={`/${lang}/topics/${slug}/add-resource`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: '1px dashed #444', color: '#777', fontSize: 13, textDecoration: 'none' }}>
                {t.rankings.proposeResource}
              </Link>
            </div>
          )}

          <UserListsSection
            topicSlug={slug}
            resources={resources.map(r => ({ id: r.id, title: r.title, emoji: r.emoji, type: r.type }))}
            userLists={userLists}
            currentUserId={currentUserId}
            isLoggedIn={isLoggedIn}
            t={t.rankings}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 32 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#777' }}>{t.rankings.general}</span>
            <div style={{ flex: 1, height: 1, background: '#2a2a2a' }} />
          </div>

          {shown.length === 0 ? (
            <p style={{ color: '#777', padding: '20px 0' }}>{t.rankings.noResources}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shown.map((r, i) => {
                const color = TYPE_COLOR[r.type] || '#7c6df0'
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '42px 52px 1fr auto', alignItems: 'center', gap: 14, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 18px' }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, textAlign: 'center', color: i < 3 ? '#c8f55a' : '#777' }}>{i + 1}</div>
                    <div style={{ width: 52, height: 52, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, background: `${color}22`, flexShrink: 0 }}>{r.emoji}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4, color: '#f0f0f0' }}>
                        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{r.title}</a> : r.title}
                        <span style={{ display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 7px', borderRadius: 4, marginLeft: 7, background: `${color}22`, color }}>{r.type}</span>
                      </div>
                      <div style={{ color: '#777', fontSize: 12 }}>{r.sub}</div>
                    </div>
                    <StarRating resourceId={r.id} topicSlug={slug} initialUserRating={r.userRating} initialAvg={r.avgRating} initialCount={r.ratingCount} isLoggedIn={isLoggedIn} t={t.starRating} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {tab === 'notes' && (
        <div style={{ padding: '28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#777' }}>
              {t.notes.community}
              <div style={{ flex: 1, height: 1, background: '#2a2a2a' }} />
            </div>
            {isLoggedIn && (
              <Link href={`/${lang}/topics/${slug}/add-note`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: '1px dashed #444', color: '#777', fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 16 }}>
                {t.notes.shareNote}
              </Link>
            )}
          </div>

          {notes.length === 0 ? (
            <p style={{ color: '#777', padding: '20px 0' }}>{t.notes.beFirst}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {notes.map(n => {
                const ac = AVATAR_COLORS[n.author.name.charCodeAt(0) % 4]
                return (
                  <div key={n.id} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0, background: `${ac}22`, color: ac, fontFamily: "'Fraunces', serif" }}>
                        {n.author.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>{n.author.name}</div>
                        <div style={{ fontSize: 11, color: '#777' }}>{relDate(n.createdAt, t.time)}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#f0f0f0', lineHeight: 1.3 }}>{n.title}</div>
                    <div style={{ color: '#999', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{n.excerpt}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {n.tags.map(tag => (
                          <span key={tag.name} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#242424', color: '#777', border: '1px solid #2a2a2a' }}>{tag.name}</span>
                        ))}
                      </div>
                      <LikeButton noteId={n.id} topicSlug={slug} initialLikes={n.likeCount} initialLiked={n.userHasLiked} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
