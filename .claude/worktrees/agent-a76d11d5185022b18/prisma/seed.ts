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
    slug: 'jazz',
    emoji: '🎷',
    badge: 'Musique',
    title: 'Jazz',
    desc: 'Improvisation, liberté, swing. Le jazz est né d\'un croisement unique de cultures et reste l\'un des langages musicaux les plus riches.',
    prose: `<h2>C'est quoi le jazz ?</h2><p>Le jazz est né au début du XXe siècle à la Nouvelle-Orléans, issu du mélange des <strong>blues, gospel et musique européenne</strong>. Sa marque de fabrique : l'<strong>improvisation</strong> — les musiciens composent en temps réel, dans le dialogue.</p><p>Ce qui rend le jazz unique c'est qu'il ne s'écoute pas passivement. Chaque concert est unique. La même chanson n'est jamais jouée pareil.</p><h2>Par où commencer ?</h2><p>Commence par <strong>Miles Davis</strong> — <em>Kind of Blue</em> reste l'album le plus accessible de l'histoire du jazz. Puis explore Coltrane, Bill Evans, Thelonious Monk.</p>`,
    diffLevel: 3,
    diffNote: "L'écoute est accessible. La théorie musicale derrière peut devenir très technique.",
    concepts: ['🎵 Improvisation', '🥁 Swing', '🎹 Accord', '🎺 Bebop', '🌙 Blues', '🎸 Standard', '🎙️ Scat'],
    related: ['🎸 Blues', '🎼 Musique classique', '🪗 Soul', '🥁 Percussions'],
    resources: [
      { title: 'Kind of Blue – Miles Davis', sub: 'Album · 1959 · Columbia', type: 'album', emoji: '💿', url: null },
      { title: 'A Love Supreme – Coltrane', sub: 'Album · 1965', type: 'album', emoji: '💿', url: null },
      { title: 'Jazz – Ken Burns', sub: 'Documentaire · PBS', type: 'video', emoji: '🎬', url: null },
      { title: 'The History of Jazz – Ted Gioia', sub: 'Livre · Oxford University Press', type: 'livre', emoji: '📚', url: null },
      { title: 'Waltz for Debby – Bill Evans', sub: 'Album · 1961', type: 'album', emoji: '💿', url: null },
    ],
  },
  {
    slug: 'crypto',
    emoji: '₿',
    badge: 'Finance & Tech',
    title: 'Crypto',
    desc: 'Monnaies décentralisées, blockchain, DeFi. Un territoire en mouvement constant, entre révolution financière et spéculation.',
    prose: `<h2>C'est quoi la crypto ?</h2><p>Les cryptomonnaies sont des <strong>monnaies numériques</strong> qui fonctionnent sans banque centrale, grâce à une technologie appelée <strong>blockchain</strong> — un registre public, décentralisé et infalsifiable.</p><p>Bitcoin a été le premier (2009). Depuis, des milliers d'autres ont émergé avec des usages très différents : Ethereum permet de créer des applications décentralisées, d'autres servent de réserve de valeur...</p><h2>Par où commencer ?</h2><p>Commence par comprendre la <strong>blockchain</strong> avant d'acheter quoi que ce soit. La vidéo "But how does Bitcoin actually work?" de 3Blue1Brown est le meilleur point d'entrée qui existe.</p>`,
    diffLevel: 4,
    diffNote: 'Conceptuellement accessible, mais les détails techniques et financiers peuvent être très complexes.',
    concepts: ['⛓️ Blockchain', '🔑 Wallet', '⛏️ Minage', '📄 Smart Contract', '🌊 DeFi', '🖼️ NFT', '📊 Altcoin'],
    related: ['🏦 Finance', '💻 Dev', '🔐 Cryptographie', '🌍 Macroéco'],
    resources: [
      { title: 'But how does Bitcoin actually work?', sub: '3Blue1Brown · YouTube', type: 'video', emoji: '🎬', url: null },
      { title: 'The Bitcoin Standard', sub: 'Livre · Saifedean Ammous', type: 'livre', emoji: '📚', url: null },
      { title: 'Blockchain & Money – MIT', sub: 'Cours gratuit · Gary Gensler', type: 'cours', emoji: '🎓', url: null },
      { title: 'Unchained Podcast', sub: 'Podcast · Laura Shin · EN', type: 'podcast', emoji: '🎙️', url: null },
    ],
  },
  {
    slug: 'cuisine',
    emoji: '🍜',
    badge: 'Art de vivre',
    title: 'Cuisine',
    desc: 'Technique, culture, plaisir. La cuisine est à la fois chimie, histoire et expression personnelle — un terrain d\'exploration infini.',
    prose: `<h2>C'est quoi, apprendre la cuisine ?</h2><p>La cuisine ce n'est pas juste suivre des recettes. C'est comprendre <strong>pourquoi ça fonctionne</strong> : pourquoi le sel change la texture, pourquoi la chaleur transforme la matière, comment les saveurs s'équilibrent.</p><p>Quand tu comprends les <strong>techniques de base</strong> plutôt que les recettes par cœur, tu peux improviser, adapter, créer — la recette devient un point de départ, pas un dogme.</p><h2>Par où commencer ?</h2><p>Maîtrise 5 techniques fondamentales : <strong>sauter, rôtir, braiser, pocher, émulsionner</strong>. Salt Fat Acid Heat de Samin Nosrat est le meilleur livre pour ça.</p>`,
    diffLevel: 2,
    diffNote: "Très accessible à tous les niveaux. La profondeur technique peut aller très loin (gastronomie moléculaire, etc.).",
    concepts: ['🔥 Chaleur', '🧂 Assaisonnement', '🫒 Émulsion', '✂️ Découpe', '⏱️ Timing', '🌿 Herbes', '🧄 Aromates'],
    related: ['🧪 Chimie', '🌍 Culture', '🥗 Nutrition', '🌾 Agriculture'],
    resources: [
      { title: 'Salt Fat Acid Heat – Samin Nosrat', sub: 'Livre · Cuisine par principes', type: 'livre', emoji: '📚', url: null },
      { title: "Chef's Table", sub: 'Netflix · Documentaire', type: 'video', emoji: '🎬', url: null },
      { title: 'Binging with Babish', sub: 'YouTube · Technique + recettes', type: 'video', emoji: '🎬', url: null },
      { title: 'MasterClass – Gordon Ramsay', sub: 'Cours en ligne', type: 'cours', emoji: '🎓', url: null },
    ],
  },
]

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('demo1234', 12)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@totantia.app' },
    update: {},
    create: { name: 'Marie L.', email: 'demo@totantia.app', passwordHash },
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
