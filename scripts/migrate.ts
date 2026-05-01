/**
 * Apply SQL migrations to the Turso database.
 *
 * Usage:
 *   yarn migrate
 *
 * Migrations are flat .sql files in prisma/migrations/, named like
 * `001_xxx.sql`, `002_xxx.sql`, applied in lexical order. Already-
 * applied migrations are tracked in the _Migrations table on Turso.
 *
 * To add a new migration:
 *   1. Edit prisma/schema.prisma
 *   2. Generate the SQL diff:
 *      npx prisma migrate diff \
 *        --from-url "$TURSO_DATABASE_URL" \
 *        --to-schema-datamodel prisma/schema.prisma \
 *        --script > prisma/migrations/00X_your_change.sql
 *   3. Review and edit the generated SQL
 *   4. Run `yarn migrate`
 */

import { createClient } from '@libsql/client'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('❌  TURSO_DATABASE_URL is not set in .env.local')
  process.exit(1)
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) })

async function run() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _Migrations (
      name TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    )
  `)

  const applied = await client.execute('SELECT name FROM _Migrations')
  const appliedNames = new Set(applied.rows.map(r => r[0] as string))

  const migrationsDir = join(process.cwd(), 'prisma', 'migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  const pending = files.filter(f => !appliedNames.has(f))

  if (pending.length === 0) {
    console.log('✅  No pending migrations.')
    return
  }

  console.log(`⚠️   Applying ${pending.length} migration(s) to ${url.replace(/\?.*$/, '')}:`)
  for (const file of pending) console.log(`     • ${file}`)
  console.log()

  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)

    for (const stmt of statements) {
      await client.execute(stmt)
    }

    await client.execute({
      sql: 'INSERT INTO _Migrations (name, appliedAt) VALUES (?, ?)',
      args: [file, new Date().toISOString()],
    })

    console.log(`✅  Applied: ${file}`)
  }
}

run().catch(e => {
  console.error('❌  Migration failed:', e.message)
  process.exit(1)
})
