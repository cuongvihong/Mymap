import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger, dayStamp } from '../src/main/shell/logger'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mapapp-log-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('logger', () => {
  it('writes one file per day named app-YYYYMMDD.log', () => {
    const now = new Date(2026, 9, 24, 20, 30, 0)
    const logger = createLogger(join(dir, 'logs'), { now: () => now })
    logger.info('app ready', { count: 3 })
    logger.error('boom', { code: 'E_TEST' })
    const file = join(dir, 'logs', `app-${dayStamp(now)}.log`)
    expect(dayStamp(now)).toBe('20261024')
    expect(existsSync(file)).toBe(true)
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/ INFO app ready \{"count":3\}$/)
    expect(lines[1]).toMatch(/ ERROR boom \{"code":"E_TEST"\}$/)
  })

  it('prune removes log files older than 14 days and keeps the rest', () => {
    const now = new Date(2026, 9, 24, 12, 0, 0)
    const logger = createLogger(dir, { now: () => now })
    writeFileSync(join(dir, 'app-20260101.log'), 'old')
    writeFileSync(join(dir, 'app-20261001.log'), 'old too')
    writeFileSync(join(dir, 'app-20261015.log'), 'recent')
    writeFileSync(join(dir, 'notes.txt'), 'not a log file')
    expect(logger.prune()).toBe(2)
    expect(readdirSync(dir).sort()).toEqual(['app-20261015.log', 'notes.txt'])
  })

  it('never throws when the log file cannot be written', () => {
    const logger = createLogger(dir)
    rmSync(dir, { recursive: true, force: true })
    expect(() => logger.warn('still fine')).not.toThrow()
  })
})
