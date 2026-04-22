#!/usr/bin/env node
import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import readline from "node:readline";
import Database from "better-sqlite3";
import StreamZip from "node-stream-zip";
import iconv from "iconv-lite";
import { createSchema, setMeta, swapLive } from "./schema.js";
import { parsePadronLine, type PadronRow } from "./parse.js";
import { defaultPadronDbPath, defaultWorkDir } from "./paths.js";

const PADRON_URL =
  process.env.PADRON_URL ?? "https://www.sunat.gob.pe/descargaPRR/padron_reducido_ruc.zip";
const DB_PATH = process.env.PADRON_DB_PATH ?? defaultPadronDbPath;
const WORK_DIR = process.env.PADRON_WORK_DIR ?? defaultWorkDir;
const BATCH_SIZE = 10_000;
const STAGING_TABLE = "ruc_staging";

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log(`[ingest] starting — db=${DB_PATH} url=${PADRON_URL}`);

  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  mkdirSync(WORK_DIR, { recursive: true });

  const zipPath = path.join(WORK_DIR, "padron.zip");
  await download(PADRON_URL, zipPath);

  const hash = await sha256(zipPath);
  const sizeBytes = statSync(zipPath).size;
  console.log(`[ingest] downloaded ${(sizeBytes / 1e6).toFixed(1)} MB, sha256=${hash.slice(0, 16)}…`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");

  createSchema(db, STAGING_TABLE);

  const insert = db.prepare(
    `INSERT OR IGNORE INTO ${STAGING_TABLE}
       (ruc, razon_social, estado, condicion, tipo_contribuyente, domicilio, ubigeo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertBatch = db.transaction((rows: PadronRow[]) => {
    for (const r of rows) {
      insert.run(r.ruc, r.razon_social, r.estado, r.condicion, r.tipo_contribuyente, r.domicilio, r.ubigeo);
    }
  });

  const { parsed, kept } = await streamZipAndLoad(zipPath, (batch) => insertBatch(batch));

  db.exec(`CREATE INDEX IF NOT EXISTS ${STAGING_TABLE}_razon_idx ON ${STAGING_TABLE} (razon_social COLLATE NOCASE)`);

  swapLive(db, STAGING_TABLE);
  setMeta(db, "last_ingested_at", new Date().toISOString());
  setMeta(db, "source_url", PADRON_URL);
  setMeta(db, "source_hash", hash);
  setMeta(db, "source_bytes", String(sizeBytes));
  setMeta(db, "row_count", String(kept));

  db.close();

  rmSync(zipPath, { force: true });

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[ingest] done — parsed=${parsed} kept=${kept} elapsed=${dt}s`);
}

async function download(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { headers: { "user-agent": "latam-mcp-ingest/0.0.0" } });
  if (!res.ok || !res.body) throw new Error(`download ${url} failed: ${res.status}`);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(destPath));
}

function sha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const buf = createReadStream(filePath);
  return new Promise<string>((resolve, reject) => {
    buf.on("data", (d) => hash.update(d as Buffer));
    buf.on("end", () => resolve(hash.digest("hex")));
    buf.on("error", reject);
  });
}

type Batcher = (rows: PadronRow[]) => void;

async function streamZipAndLoad(
  zipPath: string,
  flush: Batcher,
): Promise<{ parsed: number; kept: number }> {
  const zip = new StreamZip.async({ file: zipPath });
  const entries = await zip.entries();
  const mainEntry = Object.values(entries).find((e) => e.name.toLowerCase().endsWith(".txt"));
  if (!mainEntry) {
    await zip.close();
    throw new Error("No .txt entry found inside padrón zip");
  }
  console.log(`[ingest] reading entry ${mainEntry.name} (${(mainEntry.size / 1e6).toFixed(1)} MB)`);

  const stream = await zip.stream(mainEntry.name);
  const rl = readline.createInterface({
    input: stream.pipe(iconv.decodeStream("latin1")) as unknown as NodeJS.ReadableStream,
    crlfDelay: Infinity,
  });

  let parsed = 0;
  let kept = 0;
  let batch: PadronRow[] = [];
  let headerSeen = false;

  for await (const line of rl) {
    if (!headerSeen) {
      headerSeen = true;
      if (/^\s*RUC\b/i.test(line)) continue;
    }
    parsed++;
    const row = parsePadronLine(line);
    if (!row) continue;
    batch.push(row);
    kept++;
    if (batch.length >= BATCH_SIZE) {
      flush(batch);
      batch = [];
      if (kept % (BATCH_SIZE * 10) === 0) {
        console.log(`[ingest]   inserted ${kept.toLocaleString()} rows…`);
      }
    }
  }
  if (batch.length) flush(batch);

  await zip.close();
  return { parsed, kept };
}

main().catch((err: Error) => {
  console.error(`[ingest] FAILED: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
