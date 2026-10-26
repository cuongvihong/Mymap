import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { DiagramLogger } from '../../shared/diagram/types'

export const LOG_RETENTION_DAYS = 14
const LOG_FILE = /^app-(\d{8})\.log$/

export interface LoggerOptions {
  /** Injectable clock, used by tests. */
  now?: () => Date
  retentionDays?: number
}

export interface ShellLogger extends DiagramLogger {
  readonly dir: string
  /** Delete log files older than the retention window. Returns the number of deleted files. */
  prune(): number
}

const pad = (n: number, len = 2): string => String(n).padStart(len, '0')

export function dayStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function stampToDate(stamp: string): Date {
  return new Date(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8))
  )
}

/**
 * File logger, one file per day: `app-YYYYMMDD.log` (TDD 14).
 * Callers must pass only codes, counts and ids as meta, never user content.
 */
export function createLogger(dir: string, options: LoggerOptions = {}): ShellLogger {
  const now = options.now ?? (() => new Date())
  const retentionDays = options.retentionDays ?? LOG_RETENTION_DAYS
  mkdirSync(dir, { recursive: true })

  function write(
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    meta?: Record<string, unknown>
  ) {
    const d = now()
    const line = `${d.toISOString()} ${level} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`
    try {
      appendFileSync(join(dir, `app-${dayStamp(d)}.log`), line, 'utf8')
    } catch {
      // Logging must never crash the app.
    }
  }

  function prune(): number {
    const cutoff = now().getTime() - retentionDays * 24 * 60 * 60 * 1000
    let removed = 0
    for (const name of readdirSync(dir)) {
      const match = LOG_FILE.exec(name)
      if (!match || !match[1]) continue
      const full = join(dir, name)
      if (stampToDate(match[1]).getTime() < cutoff && statSync(full).isFile()) {
        unlinkSync(full)
        removed += 1
      }
    }
    return removed
  }

  return {
    dir,
    info: (m, meta) => write('INFO', m, meta),
    warn: (m, meta) => write('WARN', m, meta),
    error: (m, meta) => write('ERROR', m, meta),
    prune
  }
}
