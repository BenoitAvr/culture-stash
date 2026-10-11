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

const RAWG_KEY = process.env.RAWG_API_KEY
if (!RAWG_KEY) {
  console.error('RAWG_API_KEY missing in .env.local (grab a free key at https://rawg.io/apidocs)')
  process.exit(1)
}

console.log(`Seeding ${tursoUrl.replace(/\?.*$/, '')}`)
const adapter = new PrismaLibSql({ url: tursoUrl, ...(tursoToken ? { authToken: tursoToken } : {}) })
const prisma = new PrismaClient({ adapter })

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

type RawgGame = {
  id: number
  name: string
  released: string | null
  background_image: string | null
  rating: number
}

type EntryInput = {
  topicId: string
  addedById: string
  title: string
  titleEn: string | null
  tmdbId: null
  year: number | null
  cover: string | null
}

async function fetchPage(page: number, pageSize: number): Promise<RawgGame[]> {
  const url = new URL('https://api.rawg.io/api/games')
  url.searchParams.set('key', RAWG_KEY!)
  url.searchParams.set('ordering', '-rating')
  url.searchParams.set('exclude_additions', 'true')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('page', String(page))
  const res = await fetch(url.toString())
  if (!res.ok) {
    console.error(`  page ${page} HTTP ${res.status}`)
    return []
  }
  const data = await res.json() as { results?: RawgGame[] }
  return data.results ?? []
}

async function insertBatch(entries: EntryInput[]) {
  if (entries.length === 0) return 0
  const topicId = entries[0].topicId
  const titles = entries.map(e => e.title)

  const existing = await prisma.entry.findMany({
    where: { topicId, title: { in: titles } },
    select: { title: true },
  })
  const existingTitles = new Set(existing.map(e => e.title))

  const newEntries = entries.filter(e => !existingTitles.has(e.title))
  if (newEntries.length === 0) return 0
  const { count } = await prisma.entry.createMany({ data: newEntries })
  return count
}

const GAMES_TOPIC = {
  slug: 'jeux-video',
  emoji: '🎮',
  badge: 'Jeu vidéo',
  title: 'Jeux vidéo',
  rankable: true,
  desc: "Le médium qui te fait jouer au lieu de regarder. Des pixels d'arcade aux mondes ouverts photoréalistes — explorer le jeu comme forme d'art interactive.",
  prose: `<h2>C'est quoi, un jeu vidéo ?</h2><p>Un jeu vidéo c'est une œuvre qui te donne <strong>un rôle actif</strong> : tu ne regardes pas une histoire, tu la vis. Le médium combine image, son, écriture, systèmes et <strong>interactivité</strong> — ce dernier ingrédient change tout.</p><p>Un film te montre un personnage courir ; un jeu te fait courir. Cette bascule du spectateur à l'acteur crée des émotions que les autres arts n'atteignent pas : la fierté d'avoir surmonté un boss, la honte d'avoir trahi un PNJ, la mélancolie de rentrer chez soi dans un monde fictif.</p><h2>Par où commencer ?</h2><p>Commence par <strong>un genre qui te parle</strong> : narratif (Firewatch, Disco Elysium), action (Hollow Knight, Zelda), stratégie (Civilization), horreur (Resident Evil), coopération (It Takes Two). Chaque genre a sa grammaire propre.</p><h2>Pourquoi c'est un vrai art ?</h2><p>Parce qu'un bon jeu <strong>utilise ses mécaniques pour raconter</strong>. Dans Shadow of the Colossus, chaque colosse abattu te laisse plus vide — le système de progression lui-même devient le propos. Ça, aucun autre médium ne peut le faire.</p>`,
  diffLevel: 2,
  diffNote: 'Accessible dès les premières heures. La culture et la critique du médium demandent plus de temps.',
  concepts: ['🕹️ Gameplay', '🎨 Direction artistique', '🧩 Level design', '📖 Narration', '⚙️ Mécaniques', '🎵 BO', '🎬 Mise en scène'],
  related: ['🎬 Films', '📺 Séries', '⛩️ Animes', '📖 Littérature', '🎨 Design'],
  resources: [
    { title: 'Shadow of the Colossus', sub: 'Fumito Ueda · 2005', type: 'jeu', emoji: '🎮', url: null },
    { title: 'Disco Elysium', sub: 'ZA/UM · 2019', type: 'jeu', emoji: '🎮', url: null },
    { title: 'The Legend of Zelda: Breath of the Wild', sub: 'Nintendo · 2017', type: 'jeu', emoji: '🎮', url: null },
    { title: 'Hollow Knight', sub: 'Team Cherry · 2017', type: 'jeu', emoji: '🎮', url: null },
    { title: 'Game Maker’s Toolkit', sub: 'YouTube · Analyse game design', type: 'video', emoji: '🎬', url: null },
  ],
}

async function ensureTopic(userId: string) {
  const existing = await prisma.topic.findUnique({ where: { slug: GAMES_TOPIC.slug } })
  if (existing) {
    if (!existing.rankable) {
      await prisma.topic.update({ where: { id: existing.id }, data: { rankable: true } })
      console.log(`  topic "${GAMES_TOPIC.slug}" existait (rankable passé à true)`)
    } else {
      console.log(`  topic "${GAMES_TOPIC.slug}" déjà présent`)
    }
    return existing
  }
  const created = await prisma.topic.create({
    data: {
      slug: GAMES_TOPIC.slug,
      emoji: GAMES_TOPIC.emoji,
      badge: GAMES_TOPIC.badge,
      title: GAMES_TOPIC.title,
      desc: GAMES_TOPIC.desc,
      prose: GAMES_TOPIC.prose,
      diffLevel: GAMES_TOPIC.diffLevel,
      diffNote: GAMES_TOPIC.diffNote,
      rankable: GAMES_TOPIC.rankable,
      concepts: { create: GAMES_TOPIC.concepts.map(name => ({ name })) },
      related: { create: GAMES_TOPIC.related.map(name => ({ name })) },
      resources: { create: GAMES_TOPIC.resources.map(r => ({ ...r, addedById: userId })) },
    },
  })
  console.log(`  topic "${GAMES_TOPIC.slug}" créé`)
  return created
}

async function main() {
  const user = await prisma.user.findFirst()
  if (!user) throw new Error("Aucun utilisateur en base — connecte-toi d'abord sur le site")

  const topic = await ensureTopic(user.id)

  const PAGES = 25
  const PAGE_SIZE = 40
  console.log(`\n🎮 Jeux vidéo (${PAGES} pages × ${PAGE_SIZE} = ~${PAGES * PAGE_SIZE} items)…`)

  let total = 0
  for (let page = 1; page <= PAGES; page++) {
    const games = await fetchPage(page, PAGE_SIZE)
    const entries: EntryInput[] = games.map(g => ({
      topicId: topic.id,
      addedById: user.id,
      title: g.name,
      titleEn: null,
      tmdbId: null,
      year: g.released ? parseInt(g.released.slice(0, 4)) || null : null,
      cover: g.background_image,
    }))
    total += await insertBatch(entries)
    process.stdout.write(`\r  page ${page}/${PAGES} — ${total} insérés`)
    await sleep(300)
  }

  console.log('\n✅ Seed jeux vidéo terminé !')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
