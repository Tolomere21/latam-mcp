import Database from "better-sqlite3";
import { defaultPadronDbPath } from "./paths.js";

/**
 * Shared SQLite handle for the RUC padrón. The same file is written by the
 * ingest service (apps/ingest) and read here. Path defaults to ./data/padron.sqlite
 * but is overridable via PADRON_DB_PATH so Fly volumes can live elsewhere.
 *
 * `readonly: true` on the handle keeps the api process safe from accidental writes
 * and lets many readers share the file without lock contention.
 */
let cached: Database.Database | null = null;

export function getPadronDb(): Database.Database {
  if (cached) return cached;
  const path = process.env.PADRON_DB_PATH ?? defaultPadronDbPath;
  const db = new Database(path, { readonly: true, fileMustExist: false });
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 2000");
  cached = db;
  return db;
}

export function hasPadronTable(db: Database.Database): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ruc'`)
    .get();
  return !!row;
}

export function getPadronFreshness(db: Database.Database): string | null {
  try {
    const row = db
      .prepare(`SELECT value FROM meta WHERE key='last_ingested_at'`)
      .get() as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}
