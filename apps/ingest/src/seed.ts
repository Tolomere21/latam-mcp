#!/usr/bin/env node
/**
 * Seed a tiny padrón DB for local dev / smoke tests, so the api can run in
 * `SUNAT_UPSTREAM=padron` mode without a 2 GB production file. Real ingestion
 * is done by `pnpm --filter @latam-mcp/ingest start`.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createSchema, setMeta, swapLive } from "./schema.js";
import type { PadronRow } from "./parse.js";
import { defaultPadronDbPath } from "./paths.js";

const DB_PATH = process.env.PADRON_DB_PATH ?? defaultPadronDbPath;
const STAGING_TABLE = "ruc_staging";

const FIXTURES: PadronRow[] = [
  {
    ruc: "20100017491",
    razon_social: "TELEFONICA DEL PERU S.A.A.",
    estado: "ACTIVO",
    condicion: "HABIDO",
    tipo_contribuyente: "SOCIEDAD ANONIMA ABIERTA",
    domicilio: "AV. AREQUIPA NRO. 1155 LIMA - LIMA - LINCE",
    ubigeo: "150116",
  },
  {
    ruc: "20601030013",
    razon_social: "INNOVA CORP S.A.C.",
    estado: "ACTIVO",
    condicion: "HABIDO",
    tipo_contribuyente: "SOCIEDAD ANONIMA CERRADA",
    domicilio: "AV. JAVIER PRADO ESTE NRO. 1234 LIMA - LIMA - SAN ISIDRO",
    ubigeo: "150131",
  },
  {
    ruc: "10408123456",
    razon_social: "JUAN PEREZ RODRIGUEZ",
    estado: "ACTIVO",
    condicion: "HABIDO",
    tipo_contribuyente: "PERSONA NATURAL",
    domicilio: "AV. LOS INCAS NRO. 456 LIMA",
    ubigeo: "150101",
  },
];

function main(): void {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  createSchema(db, STAGING_TABLE);

  const insert = db.prepare(
    `INSERT OR REPLACE INTO ${STAGING_TABLE}
       (ruc, razon_social, estado, condicion, tipo_contribuyente, domicilio, ubigeo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const r of FIXTURES) {
      insert.run(r.ruc, r.razon_social, r.estado, r.condicion, r.tipo_contribuyente, r.domicilio, r.ubigeo);
    }
  });
  tx();

  swapLive(db, STAGING_TABLE);
  setMeta(db, "last_ingested_at", new Date().toISOString());
  setMeta(db, "source_url", "seed-fixtures");
  setMeta(db, "row_count", String(FIXTURES.length));
  db.close();
  console.log(`[seed] wrote ${FIXTURES.length} fixture rows to ${DB_PATH}`);
}

main();
