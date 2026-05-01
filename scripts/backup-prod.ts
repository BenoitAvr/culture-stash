import 'dotenv/config'
import { config } from 'dotenv'
import { createClient } from '@libsql/client'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

config({ path: '.env.local', override: true })

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('TURSO_DATABASE_URL missing — set it in .env.local')
  process.exit(1)
}

const sourceUrl: string = url
const client = createClient({ url: sourceUrl, authToken })

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number' || typeof val === 'bigint') return String(val)
  if (typeof val === 'boolean') return val ? '1' : '0'
  if (val instanceof Uint8Array) return `X'${Buffer.from(val).toString('hex')}'`
  if (val instanceof ArrayBuffer) return `X'${Buffer.from(new Uint8Array(val)).toString('hex')}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

async function main() {
  const tablesResult = await client.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )

  const lines: string[] = []
  lines.push(`-- Culture Stash backup`)
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push(`-- Source: ${sourceUrl.replace(/\?.*$/, '')}`)
  lines.push('')
  lines.push('PRAGMA foreign_keys = OFF;')
  lines.push('BEGIN TRANSACTION;')
  lines.push('')

  let totalRows = 0
  for (const tableRow of tablesResult.rows) {
    const tableName = tableRow.name as string
    const createSql = tableRow.sql as string

    lines.push(`-- Table: ${tableName}`)
    lines.push(`DROP TABLE IF EXISTS "${tableName}";`)
    lines.push(`${createSql};`)

    const rowsResult = await client.execute(`SELECT * FROM "${tableName}"`)
    if (rowsResult.rows.length > 0) {
      const cols = rowsResult.columns.map(c => `"${c}"`).join(', ')
      for (const row of rowsResult.rows) {
        const values = rowsResult.columns
          .map(col => escapeValue((row as Record<string, unknown>)[col]))
          .join(', ')
        lines.push(`INSERT INTO "${tableName}" (${cols}) VALUES (${values});`)
      }
      totalRows += rowsResult.rows.length
    }
    lines.push('')
  }

  lines.push('COMMIT;')
  lines.push('PRAGMA foreign_keys = ON;')

  mkdirSync('backups', { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `backup-${ts}.sql`
  const filepath = join('backups', filename)
  const content = lines.join('\n')
  writeFileSync(filepath, content)

  const sizeMb = (Buffer.byteLength(content) / 1024 / 1024).toFixed(2)
  console.log(`✓ Backup written to ${filepath}`)
  console.log(`  ${tablesResult.rows.length} tables, ${totalRows} rows, ${sizeMb} MB`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => client.close())
