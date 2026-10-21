import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __torobSql: postgres.Sql | undefined;
}

/** Shared connection pool (reused across Next.js hot reloads). */
export function getSql(): postgres.Sql {
  if (!globalThis.__torobSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalThis.__torobSql = postgres(url, {
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idle_timeout: 30,
      connect_timeout: 15,
      transform: { undefined: null },
    });
  }
  return globalThis.__torobSql;
}

export type Sql = postgres.Sql;
export { postgres };
