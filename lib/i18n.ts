export function pickTitle<T extends { title: string; titleEn?: string | null }>(
  entry: T,
  lang: string,
): string {
  return lang === 'en' && entry.titleEn ? entry.titleEn : entry.title
}
