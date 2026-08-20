import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
const sql = postgres(databaseUrl, { max: 1 });
try {
  await sql.unsafe(await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8"));
  console.log("Applied DirectPaw database migration.");
} finally {
  await sql.end();
}
