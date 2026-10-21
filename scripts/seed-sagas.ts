// Seed well-known film franchises as SAGA entries in the films topic.
// Idempotent: skips a name that already exists as kind=SAGA.
// Posters come from TMDB `/search/collection` so each saga gets the
// franchise-level artwork, not a single film's poster.
import 'dotenv/config'
import { config } from 'dotenv'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

config({ path: '.env.local', override: true })

const TOKEN = process.env.TMDB_READ_TOKEN!

type Collection = { id: number; name: string; poster_path?: string | null }

type SagaDef = {
  title: string            // display title (FR) that will land in Entry.title
  query: string            // search query for TMDB /search/collection
  titleEn?: string         // optional English title (otherwise null)
}

// 26 franchises detected by scanning the current catalog. Keep the FR
// title concise — the "SAGA" chip tells the user it's a franchise, no
// need for "(saga)" in the name itself.
const SAGAS: SagaDef[] = [
  { title: 'Harry Potter', query: 'Harry Potter Collection' },
  { title: 'Spider-Man', query: 'Spider-Man Collection', titleEn: 'Spider-Man' },
  { title: 'Toy Story', query: 'Toy Story Collection' },
  { title: 'John Wick', query: 'John Wick Collection' },
  { title: 'Mission: Impossible', query: 'Mission Impossible Collection' },
  { title: 'Retour vers le futur', query: 'Back to the Future Collection', titleEn: 'Back to the Future' },
  { title: 'Le Seigneur des anneaux', query: 'The Lord of the Rings Collection', titleEn: 'The Lord of the Rings' },
  { title: 'Le Hobbit', query: 'The Hobbit Collection', titleEn: 'The Hobbit' },
  { title: 'Pirates des Caraïbes', query: 'Pirates of the Caribbean Collection', titleEn: 'Pirates of the Caribbean' },
  { title: 'Avengers', query: 'Avengers Collection' },
  { title: 'Captain America', query: 'Captain America Collection' },
  { title: 'Deadpool', query: 'Deadpool Collection' },
  { title: 'Terminator', query: 'Terminator Collection' },
  { title: 'Alien', query: 'Alien Collection' },
  { title: 'Predator', query: 'Predator Collection' },
  { title: 'Star Wars', query: 'Star Wars Collection' },
  { title: 'Mad Max', query: 'Mad Max Collection' },
  { title: 'Kill Bill', query: 'Kill Bill Collection' },
  { title: 'Rocky', query: 'Rocky Collection' },
  { title: 'Astérix', query: 'Asterix' },
  { title: 'Les Indestructibles', query: 'Incredibles Collection', titleEn: 'The Incredibles' },
  { title: 'Dragons', query: 'How to Train Your Dragon Collection', titleEn: 'How to Train Your Dragon' },
  { title: 'Dragon Ball', query: 'Dragon Ball' },
  { title: 'Batman', query: 'Batman Collection' },
  { title: 'Superman', query: 'Superman Collection' },
  { title: 'Conjuring', query: 'Conjuring Collection' },
]

async function tmdb<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch { return null }
}

async function findCollectionPoster(query: string): Promise<string | null> {
  const params = new URLSearchParams({ query, language: 'fr-FR' })
  const data = await tmdb<{ results?: Collection[] }>(`/search/collection?${params}`)
  const hit = data?.results?.find(r => r.poster_path) ?? data?.results?.[0]
  if (!hit?.poster_path) return null
  return `https://image.tmdb.org/t/p/w500${hit.poster_path}`
}

async function main() {
  const adapter = new PrismaLibSql({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })
  const prisma = new PrismaClient({ adapter })
  const topic = await prisma.topic.findUnique({ where: { slug: 'films' } })
  if (!topic) throw new Error('films topic missing')

  for (const saga of SAGAS) {
    const existing = await prisma.entry.findFirst({
      where: { topicId: topic.id, kind: 'SAGA', title: saga.title },
    })
    if (existing) {
      console.log(`• exists: ${saga.title}`)
      continue
    }

    const cover = await findCollectionPoster(saga.query)
    await new Promise(r => setTimeout(r, 200))

    const created = await prisma.entry.create({
      data: {
        topicId: topic.id,
        title: saga.title,
        titleEn: saga.titleEn ?? null,
        kind: 'SAGA',
        year: null,
        cover,
        genres: null,
      },
    })
    console.log(`✓ ${saga.title}${cover ? ' (poster ok)' : ' (no poster)'} → ${created.id}`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
