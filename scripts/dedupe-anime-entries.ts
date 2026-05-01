/**
 * Dedupe animes entries by tmdbId on Turso.
 *
 * For each tmdbId with > 1 entry:
 *   - Pick the winner: most user references (UserEntry + UserEntryItem),
 *     tiebreak by latest createdAt.
 *   - Migrate UserEntry rows from losers to winner (delete on unique
 *     (userId, entryId) conflict).
 *   - Migrate UserEntryItem rows from losers to winner.
 *   - Delete loser entries.
 *
 * Usage:
 *   npx tsx scripts/dedupe-anime-entries.ts          # dry run
 *   npx tsx scripts/dedupe-anime-entries.ts --apply  # actually run
 */

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
  const dryRun = !process.argv.includes('--apply')
  console.log(`MODE: ${dryRun ? 'DRY-RUN (read-only)' : 'APPLY (will write)'}`)
  console.log(`DB:   ${url.replace(/\?.*$/, '')}\n`)

  const topic = await prisma.topic.findUnique({ where: { slug: 'animes' } })
  if (!topic) {
    console.error('Topic "animes" not found, exiting.')
    process.exit(1)
  }

  const entries = await prisma.entry.findMany({
    where: { topicId: topic.id, tmdbId: { not: null } },
    include: { _count: { select: { userEntries: true, userEntryListItems: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const groups = new Map<string, typeof entries>()
  for (const e of entries) {
    const k = e.tmdbId!
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  }

  let totalToDelete = 0
  let groupsTouched = 0

  for (const [tmdbId, group] of groups) {
    if (group.length < 2) continue
    groupsTouched++

    const sorted = [...group].sort((a, b) => {
      const ra = a._count.userEntries + a._count.userEntryListItems
      const rb = b._count.userEntries + b._count.userEntryListItems
      if (rb !== ra) return rb - ra
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    const winner = sorted[0]
    const losers = sorted.slice(1)

    console.log(`\ntmdbId=${tmdbId}  (${group.length} entries)`)
    console.log(`  KEEP   id=${winner.id} title="${winner.title}" refs=${winner._count.userEntries + winner._count.userEntryListItems} created=${winner.createdAt.toISOString().slice(0, 10)}`)
    for (const loser of losers) {
      console.log(`  DELETE id=${loser.id} title="${loser.title}" refs=${loser._count.userEntries + loser._count.userEntryListItems} created=${loser.createdAt.toISOString().slice(0, 10)}`)
      totalToDelete++
    }

    if (!dryRun) {
      for (const loser of losers) {
        // Move UserEntry rows
        const userEntries = await prisma.userEntry.findMany({ where: { entryId: loser.id } })
        for (const ue of userEntries) {
          const existing = await prisma.userEntry.findUnique({
            where: { userId_entryId: { userId: ue.userId, entryId: winner.id } },
          })
          if (existing) {
            await prisma.userEntry.delete({ where: { id: ue.id } })
          } else {
            await prisma.userEntry.update({ where: { id: ue.id }, data: { entryId: winner.id } })
          }
        }
        // Move UserEntryItem rows (no unique constraint on (listId, entryId), so just reassign)
        const moved = await prisma.userEntryItem.updateMany({
          where: { entryId: loser.id },
          data: { entryId: winner.id },
        })
        if (moved.count > 0) console.log(`    moved ${moved.count} UserEntryItem(s) ${loser.id} → ${winner.id}`)
        // Delete the loser
        await prisma.entry.delete({ where: { id: loser.id } })
      }
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Duplicate groups: ${groupsTouched}`)
  console.log(`${dryRun ? 'Would delete' : 'Deleted'}:    ${totalToDelete} entries`)
  if (dryRun) console.log('\nRun with --apply to execute.')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
