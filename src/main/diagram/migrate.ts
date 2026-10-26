import type { Database } from 'better-sqlite3'
import { MIGRATIONS, type Migration } from './migrations'

export interface MigrationResult {
  from: number
  to: number
}

/** Current module schema version, 0 when the module has never been installed in this database. */
export function currentVersion(db: Database): number {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'dg_schema_version'")
    .get()
  if (!table) return 0
  const row = db.prepare('SELECT MAX(version) AS v FROM dg_schema_version').get() as
    { v: number | null } | undefined
  return row?.v ?? 0
}

/**
 * Bring the dg_* tables to the latest version. Safe to call on every start.
 * Uses dg_schema_version only, never PRAGMA user_version, because studyapp owns that pragma [TH].
 * Each migration runs in its own transaction.
 */
export function runDiagramMigrations(
  db: Database,
  migrations: Migration[] = MIGRATIONS
): MigrationResult {
  const from = currentVersion(db)
  let version = from
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (migration.version <= version) continue
    db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('UPDATE dg_schema_version SET version = ?').run(migration.version)
    })()
    version = migration.version
  }
  return { from, to: version }
}
