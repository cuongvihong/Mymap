import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { DiagramLogger } from '../../src/shared/diagram/types'
import { runDiagramMigrations } from '../../src/main/diagram/migrate'
import { createKho } from '../../src/main/shell/kho/createKho'
import { openDatabase } from '../../src/main/shell/kho/database'
import { khoPaths } from '../../src/main/shell/kho/paths'

export const silentLogger: DiagramLogger = { info() {}, warn() {}, error() {} }

export function makeTempDir(prefix = 'mapapp-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

/** A real Kho in a temp folder with an open, migrated database. */
export function makeKho(): { root: string; db: Database.Database; cleanup: () => void } {
  const root = makeTempDir('mapapp-kho-')
  createKho(root)
  const db = openDatabase(khoPaths(root).db)
  runDiagramMigrations(db)
  return {
    root,
    db,
    cleanup: () => {
      db.close()
      removeDir(root)
    }
  }
}
