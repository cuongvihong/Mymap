import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { backupDatabase, backupName, BACKUP_KEEP } from '../src/main/shell/kho/backup'
import {
  defaultConfig,
  loadConfig,
  rememberKho,
  saveConfig,
  setLastProject,
  RECENT_KHO_MAX
} from '../src/main/shell/kho/config'
import { createKho } from '../src/main/shell/kho/createKho'
import { openDatabase } from '../src/main/shell/kho/database'
import { KhoError } from '../src/main/shell/kho/errors'
import { isKho, khoPaths } from '../src/main/shell/kho/paths'
import { resolveRoot } from '../src/main/shell/kho/resolveRoot'
import { makeTempDir, removeDir } from './helpers/kho'

const temps: string[] = []
const temp = () => {
  const d = makeTempDir()
  temps.push(d)
  return d
}
afterEach(() => {
  while (temps.length) removeDir(temps.pop() as string)
})

describe('createKho', () => {
  it('creates the folder layout of TDD 4 and a migrated database', () => {
    const root = temp()
    createKho(root)
    for (const dir of ['data', 'du-an', 'backup', 'xuat', 'thung-rac']) {
      expect(existsSync(join(root, dir)), dir).toBe(true)
    }
    expect(isKho(root)).toBe(true)
    const db = openDatabase(khoPaths(root).db)
    expect(db.prepare('SELECT version FROM dg_schema_version').get()).toEqual({ version: 2 })
    db.close()
  })

  it('accepts a folder that already holds the portable build', () => {
    const root = temp()
    mkdirSync(join(root, 'app', 'win'), { recursive: true })
    writeFileSync(join(root, 'Mo-MapApp-Windows.bat'), '')
    expect(() => createKho(root)).not.toThrow()
  })

  it('accepts every file that stage-kho puts at the root of dist/kho', () => {
    const root = temp()
    mkdirSync(join(root, 'app', 'win'), { recursive: true })
    for (const name of [
      'Mo-MapApp-Windows.bat',
      'Tao-Shortcut-MapApp.bat',
      'mo-mapapp-linux.sh',
      'HUONG-DAN-SU-DUNG.md',
      'DINH-DANG-FLOWMAP.md'
    ]) {
      writeFileSync(join(root, name), '')
    }
    expect(() => createKho(root)).not.toThrow()
  })

  it('refuses a folder with other files', () => {
    const root = temp()
    writeFileSync(join(root, 'holiday.jpg'), '')
    expect(() => createKho(root)).toThrowError(expect.objectContaining({ code: 'KHO_NOT_EMPTY' }))
    expect(isKho(root)).toBe(false)
  })

  it('refuses an existing Kho and a missing folder', () => {
    const root = temp()
    createKho(root)
    expect(() => createKho(root)).toThrowError(expect.objectContaining({ code: 'KHO_EXISTS' }))
    expect(() => createKho(join(root, 'nope'))).toThrowError(KhoError)
  })
})

describe('openDatabase', () => {
  it('sets the three pragmas of TDD 5.1', () => {
    const root = temp()
    createKho(root)
    const db = openDatabase(khoPaths(root).db)
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete')
    expect(db.pragma('synchronous', { simple: true })).toBe(2) // FULL
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    db.close()
  })
})

describe('config.json', () => {
  it('round trips through a temporary file', () => {
    const dir = temp()
    const file = join(dir, 'config.json')
    const config = setLastProject(rememberKho(defaultConfig(), '/kho/a'), '/kho/a', 7)
    saveConfig(file, config)
    expect(loadConfig(file)).toEqual(config)
    expect(existsSync(`${file}.tmp`)).toBe(false)
  })

  it('a missing or damaged file gives the default', () => {
    const dir = temp()
    expect(loadConfig(join(dir, 'config.json'))).toEqual(defaultConfig())
    writeFileSync(join(dir, 'config.json'), '{ not json')
    expect(loadConfig(join(dir, 'config.json'))).toEqual(defaultConfig())
  })

  it('ignores fields of the wrong type', () => {
    const dir = temp()
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ lastKho: 5, recentKho: ['/a', 3], lastProject: { '/a': 'x', '/b': 2 } })
    )
    expect(loadConfig(join(dir, 'config.json'))).toEqual({
      version: 1,
      lastKho: null,
      recentKho: ['/a'],
      lastProject: { '/b': 2 }
    })
  })

  it('keeps the recent list newest first, unique and capped', () => {
    let config = defaultConfig()
    for (let i = 0; i < 12; i++) config = rememberKho(config, `/kho/${i}`)
    config = rememberKho(config, '/kho/5')
    expect(config.recentKho[0]).toBe('/kho/5')
    expect(config.recentKho).toHaveLength(RECENT_KHO_MAX)
    expect(new Set(config.recentKho).size).toBe(RECENT_KHO_MAX)
    expect(config.lastKho).toBe('/kho/5')
  })

  it('setLastProject with null forgets the project', () => {
    const config = setLastProject(setLastProject(defaultConfig(), '/k', 3), '/k', null)
    expect(config.lastProject).toEqual({})
  })
})

describe('resolveRoot', () => {
  const only =
    (...roots: string[]) =>
    (p: string) =>
      roots.includes(p)

  it('prefers the Kho used last time', () => {
    const config = { ...defaultConfig(), lastKho: '/usb/Kho' }
    expect(resolveRoot('/other/Kho/app', config, only('/usb/Kho', '/other/Kho'))).toEqual({
      root: '/usb/Kho',
      source: 'last'
    })
  })

  it('falls back to the portable Kho around app/ when the last one is gone', () => {
    const config = { ...defaultConfig(), lastKho: 'E:\\Kho' }
    expect(resolveRoot('/media/usb/Kho/app', config, only('/media/usb/Kho'))).toEqual({
      root: '/media/usb/Kho',
      source: 'portable'
    })
  })

  it('returns null when nothing is a Kho', () => {
    expect(resolveRoot('/x/app', defaultConfig(), only())).toEqual({ root: null, source: null })
  })
})

describe('backupDatabase', () => {
  it('copies the database with a time stamped name', () => {
    const root = temp()
    createKho(root)
    const when = new Date(2026, 9, 24, 20, 35)
    const copy = backupDatabase(root, when)
    expect(copy).toBe(join(root, 'backup', 'mapapp-20261024-2035.db'))
    expect(backupName(when)).toBe('mapapp-20261024-2035.db')
    expect(existsSync(copy as string)).toBe(true)
  })

  it('keeps exactly the newest 10 copies', () => {
    const root = temp()
    createKho(root)
    for (let i = 0; i < 14; i++) backupDatabase(root, new Date(2026, 9, 24, 8, i))
    const files = readdirSync(join(root, 'backup')).sort()
    expect(files).toHaveLength(BACKUP_KEEP)
    expect(files[0]).toBe('mapapp-20261024-0804.db')
    expect(files[9]).toBe('mapapp-20261024-0813.db')
  })

  it('does not touch other files and returns null without a database', () => {
    const root = temp()
    expect(backupDatabase(root)).toBeNull()
    createKho(root)
    writeFileSync(join(root, 'backup', 'note.txt'), 'keep me')
    for (let i = 0; i < 12; i++) backupDatabase(root, new Date(2026, 9, 24, 9, i))
    expect(existsSync(join(root, 'backup', 'note.txt'))).toBe(true)
  })
})
