import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { runDiagramMigrations } from '../../diagram/migrate'
import { openDatabase } from './database'
import { KhoError } from './errors'
import { KHO_SUBDIRS, isKho, khoPaths } from './paths'

/** Entries that may already sit in a folder chosen for a new Kho: the portable build, its launchers and the guides. */
const ALLOWED_EXISTING = new Set([
  'app',
  'Mo-MapApp-Windows.bat',
  'mo-mapapp-linux.sh',
  'Tao-Shortcut-MapApp.bat',
  'HUONG-DAN-SU-DUNG.md',
  'DINH-DANG-FLOWMAP.md'
])

/**
 * Create a new Kho in an empty folder: sub folders of TDD 4 and an empty, migrated database.
 * The folder may already contain `app/`, the launcher scripts and the guides.
 */
export function createKho(root: string): void {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new KhoError('KHO_INVALID', 'Folder does not exist')
  }
  if (isKho(root)) throw new KhoError('KHO_EXISTS', 'This folder is already a Kho')
  const extra = readdirSync(root).filter((name) => !ALLOWED_EXISTING.has(name))
  if (extra.length > 0) throw new KhoError('KHO_NOT_EMPTY', 'Folder is not empty')

  for (const dir of KHO_SUBDIRS) mkdirSync(join(root, dir), { recursive: true })
  const db = openDatabase(khoPaths(root).db)
  try {
    runDiagramMigrations(db)
  } finally {
    db.close()
  }
}
