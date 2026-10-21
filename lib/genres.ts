// TMDB genre catalog + helpers. We store genres on Entry as a comma-
// separated list of TMDB IDs; this file translates them to URL slugs and
// locale labels. IDs come from https://api.themoviedb.org/3/genre/movie/list.

export type Genre = {
  id: number
  slug: string
  fr: string
  en: string
}

export const GENRES: Genre[] = [
  { id: 28, slug: 'action', fr: 'Action', en: 'Action' },
  { id: 12, slug: 'aventure', fr: 'Aventure', en: 'Adventure' },
  { id: 16, slug: 'animation', fr: 'Animation', en: 'Animation' },
  { id: 35, slug: 'comedie', fr: 'Comédie', en: 'Comedy' },
  { id: 80, slug: 'crime', fr: 'Crime', en: 'Crime' },
  { id: 99, slug: 'documentaire', fr: 'Documentaire', en: 'Documentary' },
  { id: 18, slug: 'drame', fr: 'Drame', en: 'Drama' },
  { id: 10751, slug: 'famille', fr: 'Famille', en: 'Family' },
  { id: 14, slug: 'fantastique', fr: 'Fantastique', en: 'Fantasy' },
  { id: 36, slug: 'histoire', fr: 'Histoire', en: 'History' },
  { id: 27, slug: 'horreur', fr: 'Horreur', en: 'Horror' },
  { id: 10402, slug: 'musique', fr: 'Musique', en: 'Music' },
  { id: 9648, slug: 'mystere', fr: 'Mystère', en: 'Mystery' },
  { id: 10749, slug: 'romance', fr: 'Romance', en: 'Romance' },
  { id: 878, slug: 'science-fiction', fr: 'Science-fiction', en: 'Science-Fiction' },
  { id: 10770, slug: 'telefilm', fr: 'Téléfilm', en: 'TV Movie' },
  { id: 53, slug: 'thriller', fr: 'Thriller', en: 'Thriller' },
  { id: 10752, slug: 'guerre', fr: 'Guerre', en: 'War' },
  { id: 37, slug: 'western', fr: 'Western', en: 'Western' },
]

const BY_ID = new Map(GENRES.map(g => [g.id, g]))
const BY_SLUG = new Map(GENRES.map(g => [g.slug, g]))

export function genreById(id: number): Genre | null {
  return BY_ID.get(id) ?? null
}

export function genreBySlug(slug: string): Genre | null {
  return BY_SLUG.get(slug) ?? null
}

export function parseGenreIds(raw: string | null | undefined): number[] {
  if (!raw) return []
  const out: number[] = []
  for (const part of raw.split(',')) {
    const n = parseInt(part.trim(), 10)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

export function serializeGenreIds(ids: number[]): string | null {
  const clean = ids.filter(n => Number.isFinite(n))
  return clean.length ? clean.join(',') : null
}

export function genreLabel(g: Genre, lang: string): string {
  return lang === 'en' ? g.en : g.fr
}
