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

console.log(`Seeding ${tursoUrl.replace(/\?.*$/, '')}`)
const adapter = new PrismaLibSql({ url: tursoUrl, ...(tursoToken ? { authToken: tursoToken } : {}) })
const prisma = new PrismaClient({ adapter })
const TOKEN = process.env.TMDB_READ_TOKEN
const IMG = 'https://image.tmdb.org/t/p/w500'

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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

type EntryInput = {
  topicId: string
  addedById: string
  title: string
  titleEn: string | null
  tmdbId: string
  year: number | null
  cover: string | null
}

async function insertBatch(entries: EntryInput[]) {
  if (entries.length === 0) return 0
  const topicId = entries[0].topicId
  const tmdbIds = entries.map(e => e.tmdbId)
  const titles = entries.map(e => e.title)

  const existing = await prisma.entry.findMany({
    where: {
      topicId,
      OR: [
        { tmdbId: { in: tmdbIds } },
        { title: { in: titles } },
      ],
    },
    select: { tmdbId: true, title: true },
  })
  const existingTmdbIds = new Set(existing.map(e => e.tmdbId).filter(Boolean) as string[])
  const existingTitles = new Set(existing.map(e => e.title))

  const newEntries = entries.filter(
    e => !existingTmdbIds.has(e.tmdbId) && !existingTitles.has(e.title)
  )
  if (newEntries.length === 0) return 0
  const { count } = await prisma.entry.createMany({ data: newEntries })
  return count
}

type TmdbItem = {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
}

async function fetchPage(endpoint: string, page: number, extraQs = '') {
  const sep = extraQs ? '&' : ''
  const fr = await tmdb(`${endpoint}?language=fr-FR&page=${page}${sep}${extraQs}`)
  await sleep(260)
  const en = await tmdb(`${endpoint}?language=en-US&page=${page}${sep}${extraQs}`)
  await sleep(260)
  const enById = new Map<number, TmdbItem>(
    (en.results ?? []).map((it: TmdbItem) => [it.id, it])
  )
  return { fr: (fr.results ?? []) as TmdbItem[], enById }
}

async function seedFromEndpoint({
  label,
  endpoint,
  topicId,
  userId,
  pages,
  extraQs = '',
  pickTitle,
  pickDate,
}: {
  label: string
  endpoint: string
  topicId: string
  userId: string
  pages: number
  extraQs?: string
  pickTitle: (it: TmdbItem) => string | undefined
  pickDate: (it: TmdbItem) => string | undefined
}) {
  console.log(`\n${label} (${pages} pages = ~${pages * 20} items)…`)
  let total = 0
  for (let page = 1; page <= pages; page++) {
    const { fr, enById } = await fetchPage(endpoint, page, extraQs)
    const entries: EntryInput[] = fr
      .map(item => {
        const frTitle = pickTitle(item)
        if (!frTitle) return null
        const en = enById.get(item.id)
        const enTitle = en ? pickTitle(en) : undefined
        const date = pickDate(item)
        return {
          topicId,
          addedById: userId,
          title: frTitle,
          titleEn: enTitle && enTitle !== frTitle ? enTitle : null,
          tmdbId: String(item.id),
          year: date ? parseInt(date.slice(0, 4)) || null : null,
          cover: item.poster_path ? `${IMG}${item.poster_path}` : null,
        }
      })
      .filter((e): e is EntryInput => e !== null)
    total += await insertBatch(entries)
    process.stdout.write(`\r  page ${page}/${pages} — ${total} insérés`)
  }
  console.log()
}

async function main() {
  const user = await prisma.user.findFirst()
  if (!user) throw new Error("Aucun utilisateur en base — connecte-toi d'abord sur le site")

  const topics = await prisma.topic.findMany({
    where: { rankable: true },
    select: { id: true, slug: true, title: true },
  })

  console.log('Topics trouvés :', topics.map(t => `${t.title} (${t.slug})`).join(', '))

  const films  = topics.find(t => t.slug === 'films')
  const series = topics.find(t => t.slug === 'series')
  const animes = topics.find(t => t.slug === 'animes')

  if (films) {
    await seedFromEndpoint({
      label: '🎬 Films',
      endpoint: '/movie/top_rated',
      topicId: films.id,
      userId: user.id,
      pages: 100,
      pickTitle: it => it.title,
      pickDate: it => it.release_date,
    })
  }

  if (series) {
    await seedFromEndpoint({
      label: '📺 Séries',
      endpoint: '/tv/top_rated',
      topicId: series.id,
      userId: user.id,
      pages: 50,
      pickTitle: it => it.name,
      pickDate: it => it.first_air_date,
    })
  }

  if (animes) {
    await seedFromEndpoint({
      label: '⛩️ Animes',
      endpoint: '/discover/tv',
      topicId: animes.id,
      userId: user.id,
      pages: 50,
      extraQs: 'with_genres=16&with_original_language=ja&sort_by=vote_count.desc',
      pickTitle: it => it.name,
      pickDate: it => it.first_air_date,
    })
  }

  if (!films && !series && !animes) {
    console.log('Aucun topic "films", "series" ou "animes" trouvé.')
    console.log('Topics disponibles :', topics.map(t => t.slug).join(', '))
  }

  console.log('\n✅ Seed terminé !')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
