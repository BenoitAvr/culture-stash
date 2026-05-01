import 'dotenv/config'
import { config } from 'dotenv'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

config({ path: '.env.local', override: true })

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

if (!tursoUrl) {
  console.error('TURSO_DATABASE_URL missing in .env.local')
  process.exit(1)
}

console.log(`Backfilling ${tursoUrl.replace(/\?.*$/, '')}`)
const adapter = new PrismaLibSql({ url: tursoUrl, ...(tursoToken ? { authToken: tursoToken } : {}) })
const prisma = new PrismaClient({ adapter })
const TOKEN = process.env.TMDB_READ_TOKEN

if (!TOKEN) {
  console.error('TMDB_READ_TOKEN manquant dans .env')
  process.exit(1)
}

async function tmdb(path: string) {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  return res.json()
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Endpoint = 'movie' | 'tv'

type SearchResult = {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
}

async function findMatch(
  query: string,
  year: number | null,
  type: Endpoint
): Promise<SearchResult | null> {
  const yearParam = year
    ? type === 'movie'
      ? `&year=${year}`
      : `&first_air_date_year=${year}`
    : ''
  const data = await tmdb(
    `/search/${type}?query=${encodeURIComponent(query)}&language=fr-FR${yearParam}`
  )
  const results = (data.results ?? []) as SearchResult[]
  if (results.length === 0) return null

  const lower = query.toLowerCase()
  const exact = results.find(r => {
    const t = type === 'movie' ? r.title : r.name
    return t && t.toLowerCase() === lower
  })
  return exact ?? results[0]
}

async function fetchEnTitle(id: number, type: Endpoint): Promise<string | null> {
  const data = await tmdb(`/${type}/${id}?language=en-US`)
  const t = type === 'movie' ? data.title : data.name
  return typeof t === 'string' ? t : null
}

async function backfillTopic(slug: string, type: Endpoint) {
  const topic = await prisma.topic.findUnique({ where: { slug } })
  if (!topic) {
    console.log(`Topic "${slug}" not found, skipping`)
    return
  }
  const entries = await prisma.entry.findMany({
    where: { topicId: topic.id, tmdbId: null },
    select: { id: true, title: true, year: true },
  })
  console.log(`\n${slug}: ${entries.length} entries to backfill`)
  if (entries.length === 0) return

  let matched = 0
  const unmatched: { title: string; year: number | null }[] = []

  for (const e of entries) {
    try {
      const m = await findMatch(e.title, e.year, type)
      await sleep(260)
      if (!m) {
        unmatched.push({ title: e.title, year: e.year })
        process.stdout.write(`\r  ${matched}/${entries.length} matched (${unmatched.length} unmatched)`)
        continue
      }
      const enTitle = await fetchEnTitle(m.id, type)
      await sleep(260)
      const frTitle = type === 'movie' ? m.title : m.name
      await prisma.entry.update({
        where: { id: e.id },
        data: {
          tmdbId: String(m.id),
          titleEn: enTitle && enTitle !== frTitle ? enTitle : null,
        },
      })
      matched++
      process.stdout.write(`\r  ${matched}/${entries.length} matched (${unmatched.length} unmatched)`)
    } catch (err) {
      unmatched.push({ title: e.title, year: e.year })
      console.error(`\n  ✗ "${e.title}" — ${(err as Error).message}`)
    }
  }
  console.log()
  if (unmatched.length > 0) {
    console.log(`\n  ⚠️  ${unmatched.length} unmatched in "${slug}":`)
    for (const u of unmatched) console.log(`     ${u.title}${u.year ? ` (${u.year})` : ''}`)
  }
}

async function main() {
  const targets: Array<[string, Endpoint]> = [
    ['films', 'movie'],
    ['series', 'tv'],
    ['animes', 'tv'],
  ]
  for (const [slug, type] of targets) {
    await backfillTopic(slug, type)
  }
  console.log('\n✅ Backfill complete')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
