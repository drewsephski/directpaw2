import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
const sql = postgres(databaseUrl, { max: 1 });
const migrationsDirectory = fileURLToPath(new URL("../db/migrations", import.meta.url));

try {
  await sql`select pg_advisory_lock(hashtext('directpaw-schema-migrations'))`;
  await sql`create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())`;
  const filenames = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of filenames) {
    const [existing] = await sql`select filename from schema_migrations where filename = ${filename}`;
    if (existing) continue;
    const migration = await readFile(`${migrationsDirectory}/${filename}`, "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`insert into schema_migrations (filename) values (${filename})`;
    });
    console.log(`Applied ${filename}`);
  }
} finally {
  await sql`select pg_advisory_unlock(hashtext('directpaw-schema-migrations'))`.catch(() => undefined);
  await sql.end();
}
