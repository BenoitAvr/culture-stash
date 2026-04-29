import "dotenv/config";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import path from "path";

config({ path: ".env.local", override: true });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local");
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), "dev.db").split(path.sep).join("/");
const local = createClient({ url: `file:///${dbPath}` });
const remote = createClient({ url: url!, authToken: authToken! });

const TABLES = [
  "User",
  "Topic",
  "Concept",
  "Related",
  "Resource",
  "Rating",
  "Note",
  "NoteTag",
  "Like",
  "TopicTranslation",
  "ResourceTranslation",
  "Entry",
  "UserEntry",
  "UserEntryList",
  "UserEntryItem",
  "UserList",
  "UserListItem",
  "UserTopicNote",
];

async function copyTable(table: string) {
  const { rows, columns } = await local.execute(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`  ${table}: empty, skipping`);
    return;
  }

  const placeholders = columns.map(() => "?").join(", ");
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const sql = `INSERT OR IGNORE INTO "${table}" (${cols}) VALUES (${placeholders})`;

  let ok = 0;
  for (const row of rows) {
    const args = columns.map((c) => row[c] ?? null);
    try {
      await remote.execute({ sql, args });
      ok++;
    } catch (e: unknown) {
      console.error(`  FAIL row in ${table}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`  ${table}: ${ok}/${rows.length} rows copied`);
}

async function main() {
  console.log("Exporting local dev.db → Turso...\n");
  for (const table of TABLES) {
    await copyTable(table);
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
