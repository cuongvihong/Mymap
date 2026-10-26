import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerDiagramIpc, type IpcMainLike } from '../src/main/diagram/ipc'
import { DIAGRAM_CHANNELS, DIAGRAM_CHANNEL_PREFIX } from '../src/shared/diagram/types'
import { SHELL_CHANNELS } from '../src/shared/api'
import { makeKho, silentLogger } from './helpers/kho'

type Handler = (event: unknown, ...args: unknown[]) => unknown

function fakeIpcMain() {
  const handlers = new Map<string, Handler>()
  const ipcMain = {
    handle: (channel: string, fn: Handler) => {
      if (handlers.has(channel)) throw new Error(`duplicate handler ${channel}`)
      handlers.set(channel, fn)
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel)
    }
  } as unknown as IpcMainLike
  const call = (channel: string, ...args: unknown[]) => {
    const fn = handlers.get(channel)
    if (!fn) throw new Error(`no handler ${channel}`)
    return fn({}, ...args) as Promise<{ ok: boolean; data?: unknown; code?: string }>
  }
  return { ipcMain, handlers, call }
}

let kho: ReturnType<typeof makeKho>
beforeEach(() => {
  kho = makeKho()
})
afterEach(() => kho.cleanup())

const allChannels = Object.values(DIAGRAM_CHANNELS).flatMap((group) => Object.values(group))

describe('registerDiagramIpc', () => {
  it('every channel of the module starts with "diagram:" and every shell channel with "shell:"', () => {
    expect(allChannels.length).toBe(8 + 6 + 3 + 3 + 4 + 3 + 1 + 6 + 8 + 4 + 4)
    for (const channel of allChannels) expect(channel.startsWith(DIAGRAM_CHANNEL_PREFIX)).toBe(true)
    for (const channel of [SHELL_CHANNELS.appInfo, ...Object.values(SHELL_CHANNELS.kho)]) {
      expect(channel.startsWith('shell:')).toBe(true)
    }
  })

  it('registers one handler per channel and removes them all on dispose', () => {
    const { ipcMain, handlers } = fakeIpcMain()
    const dispose = registerDiagramIpc(ipcMain, {
      db: kho.db,
      khoRoot: kho.root,
      logger: silentLogger
    })
    expect([...handlers.keys()].sort()).toEqual([...allChannels].sort())
    dispose()
    expect(handlers.size).toBe(0)
    // A second registration works after dispose (switching Kho).
    expect(() =>
      registerDiagramIpc(ipcMain, { db: kho.db, khoRoot: kho.root, logger: silentLogger })
    ).not.toThrow()
  })

  it('wraps results as { ok, data } and failures as { ok: false, code, message }', async () => {
    const { ipcMain, call } = fakeIpcMain()
    registerDiagramIpc(ipcMain, { db: kho.db, khoRoot: kho.root, logger: silentLogger })
    const c = DIAGRAM_CHANNELS.project

    const created = await call(c.create, 'MOE EA')
    expect(created.ok).toBe(true)
    expect(created.data).toMatchObject({ name: 'MOE EA', code: 1 })

    const dup = await call(c.create, 'moe ea')
    expect(dup).toMatchObject({ ok: false, code: 'NAME_DUPLICATE' })

    const list = await call(c.list)
    expect((list.data as unknown[]).length).toBe(1)

    expect(await call(c.load, 12345)).toMatchObject({ ok: false, code: 'PROJECT_NOT_FOUND' })
    expect(await call(c.rename, 'x', 'y')).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' })
  })

  it('turns an unexpected error into INTERNAL without leaking its message', async () => {
    const { ipcMain, call } = fakeIpcMain()
    registerDiagramIpc(ipcMain, { db: kho.db, khoRoot: kho.root, logger: silentLogger })
    kho.db.exec('DROP TABLE dg_projects')
    const result = (await call(DIAGRAM_CHANNELS.project.list)) as unknown as {
      ok: false
      code: string
      message: string
    }
    expect(result.ok).toBe(false)
    expect(result.code).toBe('INTERNAL')
    expect(result.message).toBe('Unexpected error')
  })
})
