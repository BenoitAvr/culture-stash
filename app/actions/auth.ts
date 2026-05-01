'use server'

import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'
import { generateUsername } from '@/lib/username'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'

type AuthState = { error: string } | null

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email et mot de passe requis' }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { error: 'Email ou mot de passe incorrect' }
  if (!user.passwordHash) return { error: 'Ce compte utilise la connexion Google' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'Email ou mot de passe incorrect' }

  // Backfill username for existing users
  let { username } = user
  if (!username) {
    username = await generateUsername(user.name, user.id)
    await prisma.user.update({ where: { id: user.id }, data: { username } })
  }

  await createSession({ userId: user.id, name: user.name, username, email: user.email })
  const redirectTo = (formData.get('redirectTo') as string) || '/fr/rank'
  redirect(redirectTo)
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!name || !email || !password) return { error: 'Tous les champs sont requis' }
  if (password.length < 6) return { error: 'Le mot de passe doit faire au moins 6 caractères' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'Un compte existe déjà avec cet email' }

  const passwordHash = await bcrypt.hash(password, 12)
  const username = await generateUsername(name)
  const user = await prisma.user.create({ data: { name, email, passwordHash, username } })

  await createSession({ userId: user.id, name: user.name, username, email: user.email })
  const redirectTo = (formData.get('redirectTo') as string) || '/fr/rank'
  redirect(redirectTo)
}

export async function logout() {
  await deleteSession()
  // /fr works on both hosts:
  //  - rank host: proxy rewrites /fr -> /fr/rank, renders rank home
  //  - main host: renders main home
  redirect('/fr')
}
