import Database from "better-sqlite3";

/**
 * Schema for the SUNAT padrón reducido. Created fresh on every ingest run
 * under a temporary table name, then atomically swapped over the live `ruc`
 * table. The `meta` table records provenance so the api can expose freshness
 * to customers.
 */
export function createSchema(db: Database.Database, tableName: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    DROP TABLE IF EXISTS ${tableName};
    CREATE TABLE ${tableName} (
      ruc TEXT PRIMARY KEY,
      razon_social TEXT NOT NULL,
      estado TEXT,
      condicion TEXT,
      tipo_contribuyente TEXT,
      domicilio TEXT,
      ubigeo TEXT,
      actividad_economica TEXT,
      fecha_inscripcion TEXT
    );
  `);
}

export function swapLive(db: Database.Database, stagingTable: string): void {
  const hasLive = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ruc'`)
    .get();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`DROP TABLE IF EXISTS ruc_old`);
    if (hasLive) {
      db.exec(`ALTER TABLE ruc RENAME TO ruc_old`);
    }
    db.exec(`ALTER TABLE ${stagingTable} RENAME TO ruc`);
    db.exec(`DROP TABLE IF EXISTS ruc_old`);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
}
