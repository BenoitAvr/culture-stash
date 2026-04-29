/**
 * Apply SQL migrations to the production Turso database.
 *
 * Usage:
 *   ALLOW_PROD_MIGRATION=true npx tsx scripts/migrate-prod.ts
 *
 * Never add ALLOW_PROD_MIGRATION to .env.local — it must be set explicitly
 * on the command line to prevent accidental production changes.
 *
 * Add new migrations as numbered .sql files in prisma/migrations/.
 * Already-applied migrations are tracked in the _Migrations table.
 */

import { createClient } from '@libsql/client'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

if (process.env.ALLOW_PROD_MIGRATION !== 'true') {
  console.error('❌  Set ALLOW_PROD_MIGRATION=true explicitly to run this script.')
  console.error('   Example: ALLOW_PROD_MIGRATION=true npx tsx scripts/migrate-prod.ts')
  process.exit(1)
}

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('❌  TURSO_DATABASE_URL is not set.')
  process.exit(1)
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) })

async function run() {
  // Create tracking table if it doesn't exist
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

  console.log(`⚠️   Applying ${pending.length} migration(s) to PRODUCTION:`)
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
