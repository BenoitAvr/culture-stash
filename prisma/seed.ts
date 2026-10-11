import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db').split(path.sep).join('/')
const adapter = new PrismaLibSql({ url: `file:///${dbPath}` })
const prisma = new PrismaClient({ adapter })

const TOPICS = [
  {
    slug: 'chimie',
    emoji: '🧪',
    badge: 'Science',
    title: 'Chimie',
    rankable: false,
    desc: "L'étude de la matière, de ses propriétés et de ses transformations. De la cuisine moléculaire aux médicaments — la chimie est partout.",
    prose: `<h2>C'est quoi, la chimie ?</h2><p>La chimie c'est la science qui étudie <strong>ce dont toutes les choses sont faites</strong> — les atomes et les molécules — et ce qui se passe quand ils se rencontrent. Quand tu fais cuire un œuf, tu fais de la chimie. Quand tu mélanges du vinaigre et du bicarbonate, tu fais de la chimie.</p><p>Au fond, tout dans l'univers est fait d'une centaine de types d'atomes différents (les <strong>éléments chimiques</strong>), assemblés de millions de façons pour former tout ce qui existe.</p><h2>Par où commencer ?</h2><p>Le meilleur point d'entrée c'est le <strong>tableau périodique</strong> — une carte qui liste tous les éléments connus. Pas besoin de tout mémoriser, juste comprendre sa logique : les éléments similaires sont regroupés ensemble.</p><h2>Pourquoi c'est utile ?</h2><p>La chimie est derrière <strong>tous les médicaments</strong>, les matériaux, les batteries, la cuisine, les cosmétiques... Comprendre ses bases te donne un filtre pour lire le monde autrement.</p>`,
    diffLevel: 3,
    diffNote: 'Accessible avec une bonne intro. La complexité monte avec la chimie organique et quantique.',
    concepts: ['⚛️ Atome', '🔗 Liaison', '🧫 Molécule', '🌡️ Réaction', '📋 Tableau périodique', '⚡ Électron', '🧪 Acide/Base'],
    related: ['🔬 Biologie', '⚡ Physique', '🌿 Écologie', '💊 Pharmacologie'],
    resources: [
      { title: 'Crash Course Chemistry', sub: 'YouTube · 46 épisodes', type: 'video', emoji: '🎬', url: null },
      { title: 'La Chimie pour les Nuls', sub: 'Livre · John Moore', type: 'livre', emoji: '📚', url: null },
      { title: 'Chemistry – MIT OpenCourseWare', sub: 'Cours · Gratuit en ligne', type: 'cours', emoji: '🎓', url: null },
      { title: 'Breaking Bad (+ guide chimie)', sub: 'Série + annotations communauté', type: 'video', emoji: '🎬', url: null },
      { title: 'The Alda Center Podcast', sub: 'Science communication · EN', type: 'podcast', emoji: '🎙️', url: null },
    ],
  },
  {
    slug: 'films',
    emoji: '🎬',
    badge: 'Cinéma',
    title: 'Films',
    rankable: true,
    desc: 'Septième art, rêves en mouvement. Des classiques du cinéma muet aux blockbusters modernes — explorer le film comme langage.',
    prose: `<h2>C'est quoi, le cinéma ?</h2><p>Le cinéma c'est l'art de raconter avec des <strong>images en mouvement</strong>. Contrairement à un livre, il convoque simultanément l'image, le son, le temps et l'espace pour créer une expérience sensorielle totale.</p><p>Comprendre le cinéma c'est apprendre à voir : <strong>comment un cadrage crée une émotion</strong>, comment le montage manipule le temps, comment la musique conditionne ce qu'on ressent.</p><h2>Par où commencer ?</h2><p>Commence par les <strong>genres fondateurs</strong> : le film noir des années 40, le néoréalisme italien, la Nouvelle Vague française. Ils ont établi le vocabulaire que tout le cinéma moderne utilise encore.</p><h2>Pourquoi aller au-delà des blockbusters ?</h2><p>Les films grand public sont souvent excellents — mais le <strong>cinéma d'auteur</strong> te montre jusqu'où peut aller le médium quand il n'est plus contraint par le marché.</p>`,
    diffLevel: 2,
    diffNote: "Accessible à tous. La profondeur d'analyse peut monter selon l'approche choisie.",
    concepts: ['🎥 Cadrage', '✂️ Montage', '🎭 Mise en scène', '💡 Lumière', '🎵 BO', '🖊️ Scénario', '🏆 Genre'],
    related: ['📸 Photo', '📺 Série', '🎭 Théâtre', '📖 Littérature'],
    resources: [
      { title: "2001 : L'Odyssée de l'espace", sub: 'Stanley Kubrick · 1968', type: 'film', emoji: '🎞️', url: null },
      { title: 'Mulholland Drive', sub: 'David Lynch · 2001', type: 'film', emoji: '🎞️', url: null },
      { title: 'Sur le cinéma — Tarkovski', sub: 'Livre · Essai fondamental', type: 'livre', emoji: '📚', url: null },
      { title: 'Parasite', sub: 'Bong Joon-ho · 2019', type: 'film', emoji: '🎞️', url: null },
      { title: 'Every Frame a Painting', sub: 'YouTube · Analyse cinéma', type: 'video', emoji: '🎬', url: null },
    ],
  },
  {
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
  },
]

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('demo1234', 12)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@culturestash.app' },
    update: {},
    create: { name: 'Marie L.', email: 'demo@culturestash.app', passwordHash },
  })

  for (const t of TOPICS) {
    const existing = await prisma.topic.findUnique({ where: { slug: t.slug } })
    if (existing) {
      console.log(`  skip ${t.slug} (exists)`)
      continue
    }

    const topic = await prisma.topic.create({
      data: {
        slug: t.slug,
        emoji: t.emoji,
        badge: t.badge,
        title: t.title,
        desc: t.desc,
        prose: t.prose,
        diffLevel: t.diffLevel,
        diffNote: t.diffNote,
        rankable: t.rankable,
        concepts: { create: t.concepts.map(name => ({ name })) },
        related: { create: t.related.map(name => ({ name })) },
        resources: {
          create: t.resources.map(r => ({
            ...r,
            addedById: demoUser.id,
          })),
        },
      },
    })
    console.log(`  created ${topic.slug}`)
  }

  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
