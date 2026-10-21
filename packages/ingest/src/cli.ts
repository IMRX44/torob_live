import { resolve } from "node:path";
import { postgres } from "@torob/db";
import { migrate } from "@torob/db/migrate";
import { ensureArchive } from "./archive";
import { ingest } from "./ingest";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const zip =
    process.env.DATASET_ZIP ??
    (await ensureArchive(process.env.DATASET_URL ?? "", resolve(process.env.DATA_DIR ?? "../../.data")));
  await migrate(url);
  const sql = postgres(url, { max: 4, onnotice: () => {} });
  try {
    const report = await ingest(sql, zip);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
