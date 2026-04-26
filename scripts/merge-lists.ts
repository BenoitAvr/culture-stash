import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: 'file:dev.db' }) })

async function main() {
  const all = await prisma.userEntryList.findMany({ select: { id: true, userId: true, topicId: true, type: true } })

  const seen = new Map<string, string>() // key → id to keep
  const toDelete: string[] = []

  for (const list of all) {
    const key = `${list.userId}:${list.topicId}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, list.id)
    } else {
      // Keep RANKED over TIER; if tie, keep first seen
      const existingList = all.find(l => l.id === existing)!
      if (list.type === 'RANKED' && existingList.type !== 'RANKED') {
        toDelete.push(existing)
        seen.set(key, list.id)
      } else {
        toDelete.push(list.id)
      }
    }
  }

  if (toDelete.length === 0) {
    console.log('Aucun doublon trouvé.')
  } else {
    console.log(`Suppression de ${toDelete.length} liste(s) en doublon...`)
    await prisma.userEntryList.deleteMany({ where: { id: { in: toDelete } } })
    console.log('Nettoyage terminé.')
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
