import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://culturestash.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*/auth/',
        '/*/topics/new',
        '/*/topics/*/edit',
        '/*/topics/*/translate',
        '/*/topics/*/add-note',
        '/*/topics/*/add-resource',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
