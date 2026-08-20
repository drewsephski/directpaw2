import postgres from "postgres";

let sqlInstance: ReturnType<typeof postgres> | null = null;

export function db() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  sqlInstance ??= postgres(databaseUrl, { max: 5, idle_timeout: 20, connect_timeout: 10, prepare: false });
  return sqlInstance;
}
