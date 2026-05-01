import 'dotenv/config'
import { config } from 'dotenv'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

config({ path: '.env.local', override: true })

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:dev.db'
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN
const adapter = new PrismaLibSql({ url, ...(authToken ? { authToken } : {}) })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(`DB: ${url.replace(/\?.*$/, '')}\n`)

  const allTopics = await prisma.topic.findMany({
    select: { slug: true, title: true, rankable: true, _count: { select: { entries: true } } },
    orderBy: { slug: 'asc' },
  })
  console.log('Topics:')
  for (const t of allTopics) console.log(`  ${t.slug} (${t.title}) rankable=${t.rankable} entries=${t._count.entries}`)
  console.log()

  const topic = await prisma.topic.findUnique({ where: { slug: 'animes' } })
  if (!topic) {
    console.error('\nTopic "animes" not found, exiting.')
    process.exit(0)
  }

  const entries = await prisma.entry.findMany({
    where: { topicId: topic.id },
    include: {
      _count: {
        select: {
          userEntries: true,
          userEntryListItems: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total entries: ${entries.length}\n`)

  // Group by normalized title (lowercase, stripped)
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const buckets = new Map<string, typeof entries>()
  for (const e of entries) {
    const key = `${norm(e.title)}|${e.year ?? ''}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(e)
  }

  // Also group by tmdbId for entries that have it
  const byTmdb = new Map<string, typeof entries>()
  for (const e of entries) {
    if (!e.tmdbId) continue
    if (!byTmdb.has(e.tmdbId)) byTmdb.set(e.tmdbId, [])
    byTmdb.get(e.tmdbId)!.push(e)
  }

  console.log('=== Duplicates by normalized (title, year) ===')
  let dupGroups = 0
  for (const [key, group] of buckets) {
    if (group.length < 2) continue
    dupGroups++
    console.log(`\n[${key}] ${group.length} entries:`)
    for (const e of group) {
      console.log(`  id=${e.id} title="${e.title}" titleEn="${e.titleEn ?? ''}" year=${e.year} tmdbId=${e.tmdbId ?? '-'} userEntries=${e._count.userEntries} listItems=${e._count.userEntryListItems} created=${e.createdAt.toISOString().slice(0, 10)}`)
    }
  }
  if (dupGroups === 0) console.log('  (none)')

  console.log('\n\n=== Duplicates by tmdbId ===')
  let tmdbDups = 0
  for (const [tmdbId, group] of byTmdb) {
    if (group.length < 2) continue
    tmdbDups++
    console.log(`\n[tmdbId=${tmdbId}] ${group.length} entries:`)
    for (const e of group) {
      console.log(`  id=${e.id} title="${e.title}" year=${e.year} userEntries=${e._count.userEntries} listItems=${e._count.userEntryListItems}`)
    }
  }
  if (tmdbDups === 0) console.log('  (none)')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
