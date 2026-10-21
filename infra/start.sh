#!/bin/sh
# Container entrypoint: migrate, seed the catalog once if empty, then serve.
set -e
cd /app

echo "[start] applying migrations"
node /ingest/node_modules/tsx/dist/cli.mjs /ingest/node_modules/@torob/db/src/migrate.ts

if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
  COUNT=$(node -e "
    const p=require('/ingest/node_modules/@torob/db/node_modules/postgres');
    const sql=p(process.env.DATABASE_URL,{max:1});
    sql\`SELECT count(*)::int AS n FROM shops\`.then(r=>{console.log(r[0].n);return sql.end()}).catch(()=>{console.log(0);process.exit(0)})")
  if [ "$COUNT" = "0" ]; then
    echo "[start] catalog empty: ingesting dataset (one time, ~1-2 min)"
    DATA_DIR=/data NODE_OPTIONS=--max-old-space-size=${INGEST_MEMORY_MB:-1800} \
      node /ingest/node_modules/tsx/dist/cli.mjs /ingest/src/cli.ts
  else
    echo "[start] catalog has $COUNT shops, skipping ingest"
  fi
fi

echo "[start] starting web server on :${PORT}"
exec node apps/web/server.js
