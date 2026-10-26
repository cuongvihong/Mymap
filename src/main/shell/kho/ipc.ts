import type { BrowserWindow, Dialog, IpcMain } from 'electron'
import { SHELL_CHANNELS, type KhoStatus } from '../../../shared/api'
import type { IpcResult } from '../../../shared/diagram/types'
import { KhoError, toShellFailure } from './errors'
import type { KhoManager } from './manager'

export interface KhoIpcDeps {
  ipcMain: Pick<IpcMain, 'handle'>
  dialog: Pick<Dialog, 'showOpenDialog'>
  getWindow: () => BrowserWindow | null
  manager: KhoManager
}

/** Register the `shell:kho:*` handlers. */
export function registerKhoIpc({ ipcMain, dialog, getWindow, manager }: KhoIpcDeps): void {
  const c = SHELL_CHANNELS.kho

  async function pickFolder(title: string): Promise<string> {
    const options = {
      title,
      properties: ['openDirectory' as const, 'createDirectory' as const]
    }
    const parent = getWindow()
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    const chosen = result.filePaths[0]
    if (result.canceled || !chosen) throw new KhoError('CANCELLED', 'No folder chosen')
    return chosen
  }

  async function wrap(fn: () => Promise<KhoStatus> | KhoStatus): Promise<IpcResult<KhoStatus>> {
    try {
      return { ok: true, data: await fn() }
    } catch (error) {
      return toShellFailure(error)
    }
  }

  ipcMain.handle(c.status, (): KhoStatus => manager.status())
  ipcMain.handle(c.create, () =>
    wrap(async () => manager.createAndOpen(await pickFolder('Chọn thư mục trống cho kho mới')))
  )
  ipcMain.handle(c.open, () =>
    wrap(async () => manager.openExisting(await pickFolder('Chọn thư mục kho bản đồ')))
  )
  ipcMain.handle(c.openRecent, (_event, root: unknown) => wrap(() => manager.openRecent(root)))
  ipcMain.handle(c.setLastProject, (_event, id: unknown) => {
    manager.setLastProject(typeof id === 'number' && Number.isInteger(id) ? id : null)
  })
}
