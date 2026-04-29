import "dotenv/config";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { execSync } from "child_process";
import { readFileSync } from "fs";

config({ path: ".env.local", override: true });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local");
  process.exit(1);
}

execSync(
  "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o prisma/push.sql",
  { stdio: "inherit" }
);

const sql = readFileSync("prisma/push.sql", "utf8");

async function main() {
  const client = createClient({ url, authToken });

  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^(--[^\n]*\n)+/, "").trim())
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} statements to Turso...`);

  for (const stmt of statements) {
    const clean = stmt.endsWith(";") ? stmt : stmt + ";";
    try {
      await client.execute(clean);
      console.log("OK:", clean.slice(0, 60).replace(/\n/g, " "));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        console.log("SKIP (already exists):", clean.slice(0, 60).replace(/\n/g, " "));
      } else {
        console.error("FAIL:", clean.slice(0, 80));
        console.error(msg);
      }
    }
  }

  console.log("Done.");
}

main();
