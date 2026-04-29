import { prisma } from './prisma'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'user'
}

export async function generateUsername(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name)
  const notSelf = excludeId ? { id: { not: excludeId } } : {}

  const existing = await prisma.user.findFirst({ where: { username: base, ...notSelf } })
  if (!existing) return base

  const similar = await prisma.user.findMany({
    where: { username: { startsWith: base }, ...notSelf },
    select: { username: true },
  })

  const taken = new Set(similar.map(u => u.username))
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
