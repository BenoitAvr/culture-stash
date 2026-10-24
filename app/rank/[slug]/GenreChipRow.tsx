'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { genreById, genreLabel } from '@/lib/genres'

type ChipData = { id: number; count: number }

// Single-button genre picker. Collapses what used to be a wide scrollable chip
// row into a dropdown, modelled on DecadeDropdown so the two filters share the
// same visual language. Navigates via <Link> so routing + prefetching still
// go through Next; the panel closes on pointer-leave / Escape / click outside.
export function GenreChipRow({
  genres,
  slug,
  lang,
  activeGenreId,
}: {
  genres: ChipData[]
  slug: string
  lang: string
  // When set, highlights that genre and labels the trigger button with it.
  activeGenreId?: number
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!genres || genres.length === 0) return null
  const isFr = lang === 'fr'

  const resolved = genres
    .map(g => ({ ...g, meta: genreById(g.id) }))
    .filter((x): x is ChipData & { meta: NonNullable<ReturnType<typeof genreById>> } => x.meta !== null)
  if (resolved.length === 0) return null

  const total = resolved.reduce((s, g) => s + g.count, 0)
  const activeMeta = activeGenreId !== undefined
    ? resolved.find(r => r.meta.id === activeGenreId)
    : undefined
  const active = activeMeta !== undefined
  const triggerLabel = active
    ? `${isFr ? 'Genre' : 'Genre'} : ${genreLabel(activeMeta!.meta, lang)}`
    : (isFr ? 'Filtrer par genre' : 'Filter by genre')

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={isFr ? 'Filtrer par genre' : 'Filter by genre'}
        title={active ? triggerLabel : (isFr ? 'Filtrer par genre' : 'Filter by genre')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          border: `1px solid ${active ? 'var(--accent-fg)' : 'var(--border)'}`,
          background: active ? 'var(--accent-faint)' : (open ? 'var(--bg-subtle)' : 'transparent'),
          color: active ? 'var(--accent-fg)' : 'var(--fg-5)',
          fontWeight: active ? 700 : 500,
          fontSize: 12.5,
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}
      >
        <span>{isFr ? 'Genre' : 'Genre'}{active ? ` : ${genreLabel(activeMeta!.meta, lang)}` : ''}</span>
        <span aria-hidden style={{ fontSize: 14, opacity: 0.75, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={isFr ? 'Filtrer par genre' : 'Filter by genre'}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            background: 'var(--bg-card)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: '0 12px 32px rgba(0,0,0,.12)',
            minWidth: 240,
            padding: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          <Link
            href={`/${lang}/rank/${slug}`}
            prefetch={false}
            role="option"
            aria-selected={!active}
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '7px 12px', borderRadius: 6,
              background: !active ? 'var(--bg-subtle)' : 'transparent',
              color: !active ? 'var(--fg-2)' : 'var(--fg-3)',
              fontSize: 13, fontFamily: 'inherit', textDecoration: 'none',
              fontWeight: !active ? 600 : 500,
            }}
          >
            <span>{isFr ? 'Tous les genres' : 'All genres'}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-6)', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          </Link>
          <div aria-hidden style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />
          {resolved.map(({ meta, count }) => {
            const isActive = activeGenreId === meta.id
            const label = genreLabel(meta, lang)
            return (
              <Link
                key={meta.id}
                href={`/${lang}/rank/${slug}/genre/${meta.slug}`}
                prefetch={false}
                role="option"
                aria-selected={isActive}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '7px 12px', borderRadius: 6,
                  background: isActive ? 'var(--accent-faint)' : 'transparent',
                  color: isActive ? 'var(--accent-fg)' : 'var(--fg-3)',
                  fontSize: 13, fontFamily: 'inherit', textDecoration: 'none',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span>{label}</span>
                <span style={{ fontSize: 11, color: isActive ? 'var(--accent-fg)' : 'var(--fg-6)', opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
