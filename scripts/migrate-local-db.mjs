import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const dbFile = path.resolve(process.cwd(), "data", "lms-db.json");
if (!fs.existsSync(dbFile)) {
  throw new Error(`Local LMS database not found at ${dbFile}`);
}

const data = JSON.parse(fs.readFileSync(dbFile, "utf8"));
const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS skillbridge_lms_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

await sql`
  INSERT INTO skillbridge_lms_state (id, data)
  VALUES ('primary', ${JSON.stringify(data)}::jsonb)
  ON CONFLICT (id)
  DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
`;

console.log("SkillBridge LMS database migrated to Neon.");
