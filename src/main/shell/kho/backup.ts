import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { khoPaths } from './paths'

export const BACKUP_KEEP = 10
const BACKUP_FILE = /^mapapp-\d{8}-\d{4}\.db$/
const pad = (n: number) => String(n).padStart(2, '0')

export function backupName(d: Date): string {
  return `mapapp-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.db`
}

/**
 * Copy the database into backup/ and keep the newest 10 copies (FR-DA-05).
 * Call it before the database is opened, the file is then closed and consistent.
 * Returns the path of the copy, or null when there is no database yet.
 */
export function backupDatabase(root: string, now: Date = new Date()): string | null {
  const paths = khoPaths(root)
  if (!existsSync(paths.db)) return null
  mkdirSync(paths.backup, { recursive: true })
  const target = join(paths.backup, backupName(now))
  copyFileSync(paths.db, target)

  const copies = readdirSync(paths.backup)
    .filter((name) => BACKUP_FILE.test(name))
    .sort()
    .reverse()
  for (const old of copies.slice(BACKUP_KEEP)) unlinkSync(join(paths.backup, old))
  return target
}
