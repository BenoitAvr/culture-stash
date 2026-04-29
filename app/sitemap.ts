import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://culturestash.com'
const LANGS = ['fr', 'en']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [topics, rankableTopics] = await Promise.all([
    prisma.topic.findMany({ select: { slug: true, createdAt: true } }),
    prisma.topic.findMany({ where: { rankable: true }, select: { slug: true, createdAt: true } }),
  ])

  const staticRoutes = LANGS.flatMap(lang => [
    { url: `${SITE_URL}/${lang}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${SITE_URL}/${lang}/rank`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${SITE_URL}/${lang}/search`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
  ])

  const topicRoutes = topics.flatMap(t =>
    LANGS.map(lang => ({
      url: `${SITE_URL}/${lang}/topics/${t.slug}`,
      lastModified: t.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  )

  const rankRoutes = rankableTopics.flatMap(t =>
    LANGS.map(lang => ({
      url: `${SITE_URL}/${lang}/rank/${t.slug}`,
      lastModified: t.createdAt,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }))
  )

  return [...staticRoutes, ...topicRoutes, ...rankRoutes]
}
