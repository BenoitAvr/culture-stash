import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: 'file:dev.db' })
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

async function insertBatch(entries: { topicId: string; addedById: string; title: string; year: number | null; cover: string | null }[]) {
  if (entries.length === 0) return 0
  const existing = await prisma.entry.findMany({
    where: { topicId: entries[0].topicId, title: { in: entries.map(e => e.title) } },
    select: { title: true },
  })
  const existingTitles = new Set(existing.map(e => e.title))
  const newEntries = entries.filter(e => !existingTitles.has(e.title))
  if (newEntries.length === 0) return 0
  const { count } = await prisma.entry.createMany({ data: newEntries })
  return count
}

async function seedMovies(topicId: string, userId: string) {
  console.log('\n🎬 Films (50 pages = ~1000 films)...')
  let total = 0
  for (let page = 1; page <= 50; page++) {
    const data = await tmdb(`/movie/top_rated?language=fr-FR&page=${page}`)
    const entries = (data.results ?? [])
      .filter((m: any) => m.title)
      .map((m: any) => ({
        topicId,
        addedById: userId,
        title: m.title,
        year: m.release_date ? parseInt(m.release_date.slice(0, 4)) || null : null,
        cover: m.poster_path ? `${IMG}${m.poster_path}` : null,
      }))
    total += await insertBatch(entries)
    process.stdout.write(`\r  page ${page}/50 — ${total} insérés`)
    await sleep(260)
  }
  console.log()
}

async function seedSeries(topicId: string, userId: string) {
  console.log('\n📺 Séries (10 pages = ~200 séries)...')
  let total = 0
  for (let page = 1; page <= 10; page++) {
    const data = await tmdb(`/tv/top_rated?language=fr-FR&page=${page}`)
    const entries = (data.results ?? [])
      .filter((s: any) => s.name)
      .map((s: any) => ({
        topicId,
        addedById: userId,
        title: s.name,
        year: s.first_air_date ? parseInt(s.first_air_date.slice(0, 4)) || null : null,
        cover: s.poster_path ? `${IMG}${s.poster_path}` : null,
      }))
    total += await insertBatch(entries)
    process.stdout.write(`\r  page ${page}/10 — ${total} insérés`)
    await sleep(260)
  }
  console.log()
}

async function seedAnime(topicId: string, userId: string) {
  console.log('\n🍜 Animes (10 pages = ~200 animes)...')
  let total = 0
  for (let page = 1; page <= 10; page++) {
    const data = await tmdb(
      `/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_count.desc&page=${page}`
    )
    const entries = (data.results ?? [])
      .filter((a: any) => a.name)
      .map((a: any) => ({
        topicId,
        addedById: userId,
        title: a.name,
        year: a.first_air_date ? parseInt(a.first_air_date.slice(0, 4)) || null : null,
        cover: a.poster_path ? `${IMG}${a.poster_path}` : null,
      }))
    total += await insertBatch(entries)
    process.stdout.write(`\r  page ${page}/10 — ${total} insérés`)
    await sleep(260)
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

  if (films)  await seedMovies(films.id,  user.id)
  if (series) await seedSeries(series.id, user.id)
  if (animes) await seedAnime(animes.id,  user.id)

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
