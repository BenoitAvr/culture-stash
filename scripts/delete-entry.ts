import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: 'file:dev.db' }) })

const title = process.argv[2]
if (!title) { console.error('Usage: npx tsx scripts/delete-entry.ts "titre"'); process.exit(1) }

async function main() {
  const { count } = await prisma.entry.deleteMany({ where: { title } })
  console.log(`${count} entrée(s) supprimée(s) : "${title}"`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
