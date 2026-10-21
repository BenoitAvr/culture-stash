// Backfill `Entry.genres` from TMDB for existing film entries.
//
// Strategy:
//   • If an Entry has `tmdbId`, call /movie/{id} — exact match, no guessing.
//   • Otherwise, call /search/movie?query=…&year=… and take `genre_ids`
//     from the top result (same heuristic as addEntry()).
//
// Usage:  npx tsx scripts/backfill-genres.ts
//         --dry           don't write to DB, just log
//         --topic=films   restrict to a specific topic slug (default: films)
//         --force         re-fetch even entries that already have genres
import 'dotenv/config'
import { config } from 'dotenv'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { serializeGenreIds } from '../lib/genres'

config({ path: '.env.local', override: true })

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN
const TOKEN = process.env.TMDB_READ_TOKEN

if (!tursoUrl) {
  console.error('TURSO_DATABASE_URL missing in .env.local')
  process.exit(1)
}
if (!TOKEN) {
  console.error('TMDB_READ_TOKEN missing in .env.local')
  process.exit(1)
}

const DRY = process.argv.includes('--dry')
const FORCE = process.argv.includes('--force')
const topicArg = process.argv.find(a => a.startsWith('--topic='))
const topicSlug = topicArg ? topicArg.slice('--topic='.length) : 'films'

console.log(`Backfilling genres on ${tursoUrl.replace(/\?.*$/, '')} (topic=${topicSlug}, dry=${DRY}, force=${FORCE})`)
const adapter = new PrismaLibSql({ url: tursoUrl, ...(tursoToken ? { authToken: tursoToken } : {}) })
const prisma = new PrismaClient({ adapter })

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function tmdb<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

type MovieDetails = { id: number; genres?: Array<{ id: number; name: string }> }
type SearchResults = { results?: Array<{ id: number; title?: string; genre_ids?: number[] }> }

async function fetchGenresById(tmdbId: string): Promise<number[] | null> {
  const data = await tmdb<MovieDetails>(`/movie/${tmdbId}?language=fr-FR`)
  if (!data || !Array.isArray(data.genres)) return null
  return data.genres.map(g => g.id).filter(Number.isFinite)
}

async function fetchGenresBySearch(title: string, year: number | null): Promise<number[] | null> {
  const params = new URLSearchParams({ query: title, language: 'fr-FR', include_adult: 'false' })
  if (year) params.set('year', String(year))
  const data = await tmdb<SearchResults>(`/search/movie?${params}`)
  const first = data?.results?.[0]
  if (!first || !Array.isArray(first.genre_ids)) return null
  return first.genre_ids.filter(Number.isFinite)
}

async function main() {
  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } })
  if (!topic) {
    console.error(`Topic "${topicSlug}" not found`)
    process.exit(1)
  }

  const entries = await prisma.entry.findMany({
    where: {
      topicId: topic.id,
      kind: 'FILM',
      ...(FORCE ? {} : { genres: null }),
    },
    select: { id: true, title: true, year: true, tmdbId: true },
  })

  console.log(`\n${entries.length} entries to process`)
  if (entries.length === 0) return

  let matched = 0
  let empty = 0
  const unmatched: { title: string; year: number | null }[] = []
  const total = entries.length
  let i = 0

  for (const e of entries) {
    i++
    try {
      let ids: number[] | null = null
      if (e.tmdbId) ids = await fetchGenresById(e.tmdbId)
      if (!ids || ids.length === 0) ids = await fetchGenresBySearch(e.title, e.year)
      await sleep(220)

      if (!ids) {
        unmatched.push({ title: e.title, year: e.year })
        console.log(`[${i}/${total}] ✗ ${e.title}${e.year ? ` (${e.year})` : ''}`)
      } else if (ids.length === 0) {
        empty++
        console.log(`[${i}/${total}] – ${e.title} (no genres)`)
      } else {
        const serialized = serializeGenreIds(ids)
        if (!DRY) {
          await prisma.entry.update({ where: { id: e.id }, data: { genres: serialized } })
        }
        matched++
        console.log(`[${i}/${total}] ✓ ${e.title} → ${serialized}`)
      }
    } catch (err) {
      unmatched.push({ title: e.title, year: e.year })
      console.error(`[${i}/${total}] ✗ "${e.title}" — ${(err as Error).message}`)
    }
  }

  console.log(`\nSummary: ${matched} matched · ${empty} no-genre · ${unmatched.length} unmatched`)
  if (unmatched.length > 0) {
    console.log(`\n  ⚠️  ${unmatched.length} unmatched:`)
    for (const u of unmatched) console.log(`     ${u.title}${u.year ? ` (${u.year})` : ''}`)
  }
  console.log(`\n${DRY ? '(dry run) ' : ''}✅ Done`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
