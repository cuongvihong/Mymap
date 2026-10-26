import { existsSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcMainLike } from '../src/main/diagram/ipc'
import { KhoManager } from '../src/main/shell/kho/manager'
import type { KhoHealth } from '../src/shared/api'
import { DIAGRAM_CHANNELS } from '../src/shared/diagram/types'
import { makeTempDir, removeDir, silentLogger } from './helpers/kho'

const allChannels = Object.values(DIAGRAM_CHANNELS).flatMap((group) => Object.values(group))

type Handler = (event: unknown, ...args: unknown[]) => unknown

let appDir: string
let khoParent: string
let handlers: Map<string, Handler>
let health: KhoHealth[]
let manager: KhoManager

const ipcMain = (): IpcMainLike =>
  ({
    handle: (c: string, fn: Handler) => handlers.set(c, fn),
    removeHandler: (c: string) => handlers.delete(c)
  }) as unknown as IpcMainLike

const call = async (channel: string, ...args: unknown[]) =>
  (await (handlers.get(channel) as Handler)({}, ...args)) as { ok: boolean; data?: unknown }

function newManager() {
  return new KhoManager({
    appDir,
    configFile: join(appDir, 'config.json'),
    logger: silentLogger,
    ipcMain: ipcMain(),
    emitHealth: (h) => health.push(h),
    now: () => new Date(2026, 9, 24, 20, 35)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  appDir = makeTempDir('mapapp-app-')
  khoParent = makeTempDir('mapapp-kho-')
  handlers = new Map()
  health = []
  manager = newManager()
})

afterEach(() => {
  manager.close()
  vi.useRealTimers()
  removeDir(appDir)
  removeDir(khoParent)
})

describe('KhoManager', () => {
  it('starts without a Kho, then creates one and registers the diagram handlers', () => {
    expect(manager.startup()).toMatchObject({ root: null, health: 'ok', lastProjectId: null })
    expect(handlers.size).toBe(0)

    const status = manager.createAndOpen(khoParent)
    expect(status.root).toBe(khoParent)
    expect(status.recent).toEqual([khoParent])
    expect([...handlers.keys()].sort()).toEqual(allChannels.sort())
    // Opening a Kho backs up its database, a new Kho included.
    expect(readdirSync(join(khoParent, 'backup'))).toEqual(['mapapp-20261024-2035.db'])
  })

  it('remembers the Kho and the last project across a restart (FR-DA-01 AC1)', async () => {
    manager.createAndOpen(khoParent)
    const created = await call(DIAGRAM_CHANNELS.project.create, 'MOE EA')
    const id = (created.data as { id: number }).id
    manager.setLastProject(id)
    manager.close()

    const second = newManager()
    const status = second.startup()
    expect(status.root).toBe(khoParent)
    expect(status.lastProjectId).toBe(id)
    const list = await call(DIAGRAM_CHANNELS.project.list)
    expect((list.data as { name: string }[]).map((p) => p.name)).toEqual(['MOE EA'])
    second.close()
  })

  it('writes one backup each time the Kho is opened, never more than 10', () => {
    manager.createAndOpen(khoParent)
    for (let minute = 0; minute < 14; minute++) {
      const m = new KhoManager({
        appDir,
        configFile: join(appDir, 'config.json'),
        logger: silentLogger,
        ipcMain: ipcMain(),
        emitHealth: () => {},
        now: () => new Date(2026, 9, 24, 21, minute)
      })
      m.startup()
      m.close()
    }
    expect(readdirSync(join(khoParent, 'backup'))).toHaveLength(10)
  })

  it('refuses a folder that is not a Kho and a path outside the recent list', () => {
    expect(() => manager.openExisting(khoParent)).toThrowError(
      expect.objectContaining({ code: 'KHO_INVALID' })
    )
    expect(() => manager.openRecent('/etc')).toThrowError(
      expect.objectContaining({ code: 'KHO_NOT_ALLOWED' })
    )
    expect(() => manager.openRecent(42)).toThrowError(
      expect.objectContaining({ code: 'KHO_NOT_ALLOWED' })
    )
  })

  it('opens the portable Kho around app/ when there is no history', () => {
    const portableApp = join(khoParent, 'app')
    manager.createAndOpen(khoParent)
    manager.close()
    const fresh = makeTempDir('mapapp-app-')
    const m = new KhoManager({
      appDir: portableApp,
      configFile: join(fresh, 'config.json'),
      logger: silentLogger,
      ipcMain: ipcMain(),
      emitHealth: () => {}
    })
    expect(m.startup().root).toBe(khoParent)
    m.close()
    removeDir(fresh)
  })

  it('switching Kho closes the old one and keeps one set of handlers', () => {
    manager.createAndOpen(khoParent)
    const other = makeTempDir('mapapp-kho2-')
    try {
      manager.createAndOpen(other)
      expect(manager.status().root).toBe(other)
      expect(manager.status().recent).toEqual([other, khoParent])
      expect(handlers.size).toBe(allChannels.length)
      manager.openRecent(khoParent)
      expect(manager.status().root).toBe(khoParent)
    } finally {
      manager.close()
      removeDir(other)
    }
  })

  // Windows refuses to rename a folder that holds an open SQLite file (EPERM), so the unplugged USB
  // cannot be imitated this way there. Check it by hand: pull the USB while the app runs.
  it.skipIf(process.platform === 'win32')(
    'reports the Kho lost when the folder disappears and recovers by itself (USB unplugged)',
    async () => {
      manager.createAndOpen(khoParent)
      await call(DIAGRAM_CHANNELS.project.create, 'Before')

      renameSync(join(khoParent, 'data'), join(khoParent, 'data-away'))
      vi.advanceTimersByTime(3000)
      expect(health).toEqual(['lost'])
      expect(manager.status().health).toBe('lost')
      vi.advanceTimersByTime(9000)
      expect(health).toEqual(['lost'])

      renameSync(join(khoParent, 'data-away'), join(khoParent, 'data'))
      vi.advanceTimersByTime(3000)
      expect(health).toEqual(['lost', 'ok'])
      expect(manager.status().health).toBe('ok')

      // The new connection works and sees the data written before.
      const list = await call(DIAGRAM_CHANNELS.project.list)
      expect((list.data as { name: string }[]).map((p) => p.name)).toEqual(['Before'])
      expect(existsSync(join(khoParent, 'data', 'mapapp.db'))).toBe(true)
    }
  )
})
