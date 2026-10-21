import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { join } from "node:path";
import yauzl from "yauzl";
import { parse } from "csv-parse";

/** Downloads the dataset zip once into the cache dir. */
export async function ensureArchive(url: string, cacheDir: string): Promise<string> {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, "dataset.zip");
  if (existsSync(file) && statSync(file).size > 1_000_000) return file;
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file));
  return file;
}

/** Streams the rows of one CSV inside the zip, with `null` literals turned into null. */
export async function* readCsv(zipPath: string, name: string): AsyncGenerator<Record<string, string | null>> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) =>
    yauzl.open(zipPath, { lazyEntries: true }, (e, z) => (e ? rej(e) : res(z!))),
  );
  const entry = await new Promise<yauzl.Entry>((res, rej) => {
    zip.on("entry", (en: yauzl.Entry) => (en.fileName.endsWith(name) ? res(en) : zip.readEntry()));
    zip.on("end", () => rej(new Error(`${name} not found in archive`)));
    zip.readEntry();
  });
  const stream = await new Promise<NodeJS.ReadableStream>((res, rej) =>
    zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s!))),
  );
  const parser = stream.pipe(parse({ columns: true, relax_quotes: true, bom: true }));
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v === "null" || v === "" ? null : v;
    yield out;
  }
  zip.close();
}
