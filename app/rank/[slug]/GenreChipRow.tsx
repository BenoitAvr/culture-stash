import Link from 'next/link'
import { genreById, genreLabel } from '@/lib/genres'

type ChipData = { id: number; count: number }

// Horizontal, scrollable chip row for genre navigation. Rendered as a
// server component since each chip is just a link to a sous-route.
export function GenreChipRow({
  genres,
  slug,
  lang,
  activeGenreId,
}: {
  genres: ChipData[]
  slug: string
  lang: string
  // When set, highlights that chip and the "Tous" chip is a back link.
  activeGenreId?: number
}) {
  if (!genres || genres.length === 0) return null
  const isFr = lang === 'fr'

  // Resolve + preserve ranking order (already sorted by count desc), skip
  // unknown TMDB ids (shouldn't happen but safe-guard against stale data).
  const resolved = genres
    .map(g => ({ ...g, meta: genreById(g.id) }))
    .filter((x): x is ChipData & { meta: NonNullable<ReturnType<typeof genreById>> } => x.meta !== null)
  if (resolved.length === 0) return null

  return (
    <div
      role="navigation"
      aria-label={isFr ? 'Filtrer par genre' : 'Filter by genre'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '2px 2px 12px',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <AllChip slug={slug} lang={lang} active={activeGenreId === undefined} />
      {resolved.map(({ meta, count }) => {
        const active = activeGenreId === meta.id
        const label = genreLabel(meta, lang)
        return (
          <Link
            key={meta.id}
            href={`/${lang}/rank/${slug}/genre/${meta.slug}`}
            prefetch={false}
            title={isFr ? `${count} films — ${label}` : `${count} films — ${label}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px',
              borderRadius: 999,
              border: `1px solid ${active ? 'var(--accent-fg)' : 'var(--border)'}`,
              background: active ? 'var(--accent-faint)' : 'transparent',
              color: active ? 'var(--accent-fg)' : 'var(--fg-5)',
              fontSize: 12.5, fontWeight: active ? 700 : 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              lineHeight: 1.3,
              flexShrink: 0,
            }}
          >
            <span>{label}</span>
            <span style={{ fontSize: 11, color: active ? 'var(--accent-fg)' : 'var(--fg-6)', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {count}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function AllChip({ slug, lang, active }: { slug: string; lang: string; active: boolean }) {
  const label = lang === 'fr' ? 'Tous' : 'All'
  return (
    <Link
      href={`/${lang}/rank/${slug}`}
      prefetch={false}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--fg-4)' : 'var(--border)'}`,
        background: active ? 'var(--bg-subtle)' : 'transparent',
        color: active ? 'var(--fg-2)' : 'var(--fg-5)',
        fontSize: 12.5, fontWeight: active ? 700 : 500,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        lineHeight: 1.3,
        flexShrink: 0,
      }}
    >
      {label}
    </Link>
  )
}
