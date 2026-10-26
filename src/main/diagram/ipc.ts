import type { IpcMain } from 'electron'
import { DIAGRAM_CHANNELS, type IpcFailure, type IpcResult } from '../../shared/diagram/types'
import type { DiagramContext } from './context'
import { DiagramError, toFailure } from './errors'
import { electronImageHost } from './electronHost'
import { setImageContext } from './imageProtocol'
import { createExportService } from './services/export'
import { createFsService, type OpenPath } from './services/fs'
import { createGroupService } from './services/group'
import { createHistoryService } from './services/history'
import { createImageService, type ImageHost } from './services/image'
import { createLinkService } from './services/link'
import { createNodeService } from './services/node'
import { createPinService } from './services/pin'
import { createProjectService } from './services/project'
import { createScenarioService } from './services/scenario'
import { createYamlService } from './services/yaml'

/** shell.openPath by default. Electron is loaded on first use so the module stays testable under Node. */
function openPathOf(custom: OpenPath | undefined): OpenPath {
  return (
    custom ??
    (async (absolute) => {
      const { shell } = await import('electron')
      return shell.openPath(absolute)
    })
  )
}

/** The part of ipcMain the module needs. Lets tests pass a fake. */
export type IpcMainLike = Pick<IpcMain, 'handle' | 'removeHandler'>

/**
 * Register every `diagram:*` handler. Returns a function that removes them again,
 * the shell calls it before it registers a new context (switching or recovering a Kho).
 */
export function registerDiagramIpc(
  ipcMain: IpcMainLike,
  ctx: DiagramContext,
  extras: {
    openPath?: OpenPath
    imageHost?: ImageHost
    pickImages?: () => Promise<string[]>
    /** Absolute path of the file chosen for import, null when the dialog is closed. */
    pickImportFile?: () => Promise<string | null>
  } = {}
): () => void {
  const project = createProjectService(ctx)
  const node = createNodeService(ctx)
  const group = createGroupService(ctx)
  const link = createLinkService(ctx)
  const scenario = createScenarioService(ctx)
  const history = createHistoryService(ctx)
  const yaml = createYamlService(ctx)
  const image = createImageService(ctx, { host: extras.imageHost ?? electronImageHost })
  const pin = createPinService(ctx)
  setImageContext(ctx)
  const fs = createFsService(ctx, { openPath: openPathOf(extras.openPath) })
  const exporter = createExportService(ctx, { openPath: openPathOf(extras.openPath) })
  const channels: string[] = []

  function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => T | Promise<T>) {
    channels.push(channel)
    ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<T>> => {
      try {
        return { ok: true, data: await fn(...(args as A)) }
      } catch (error) {
        const failure: IpcFailure = toFailure(error)
        // Only the code is logged, never names or content (TDD 14).
        if (failure.code === 'INTERNAL') ctx.logger.error('ipc failed', { channel })
        return failure
      }
    })
  }

  const c = DIAGRAM_CHANNELS.project
  handle(c.list, () => project.list())
  handle(c.create, (name: unknown) => project.create(name))
  handle(c.rename, (id: unknown, name: unknown) => project.rename(id, name))
  handle(c.remove, (id: unknown) => project.remove(id))
  handle(c.load, (id: unknown) => project.load(id))
  handle(c.saveViewport, (id: unknown, viewport: unknown) => project.saveViewport(id, viewport))
  handle(c.saveSettings, (id: unknown, patch: unknown) => project.saveSettings(id, patch))
  async function pickDocsRoot(id: unknown) {
    // Electron is loaded here, not at the top, so the rest of the module stays testable under Node.
    const { BrowserWindow, dialog } = await import('electron')
    const parent = BrowserWindow.getFocusedWindow()
    const options = { properties: ['openDirectory' as const] }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    const chosen = result.filePaths[0]
    if (result.canceled || !chosen) throw new DiagramError('CANCELLED', 'No folder chosen')
    return project.setDocsRoot(id, chosen)
  }
  handle(c.setDocsRoot, pickDocsRoot)

  const f = DIAGRAM_CHANNELS.fs
  handle(f.open, (nodeId: unknown) => fs.open(nodeId))
  handle(f.exists, (projectId: unknown, relPaths: unknown) => fs.exists(projectId, relPaths))
  handle(f.pick, pickDocsRoot)

  const n = DIAGRAM_CHANNELS.node
  handle(n.create, (projectId: unknown, input: unknown) => node.create(projectId, input))
  handle(n.update, (id: unknown, patch: unknown) => node.update(id, patch))
  handle(n.remove, (ids: unknown) => node.remove(ids))
  handle(n.impact, (ids: unknown) => node.impact(ids))
  handle(n.move, (batch: unknown) => node.move(batch))
  handle(n.setGroup, (ids: unknown, groupId: unknown) => node.setGroup(ids, groupId))

  const g = DIAGRAM_CHANNELS.group
  handle(g.create, (projectId: unknown, input: unknown) => group.create(projectId, input))
  handle(g.update, (id: unknown, patch: unknown) => group.update(id, patch))
  handle(g.remove, (id: unknown, keepNodes: unknown) => group.remove(id, keepNodes))

  const l = DIAGRAM_CHANNELS.link
  handle(l.create, (projectId: unknown, input: unknown) => link.create(projectId, input))
  handle(l.update, (id: unknown, patch: unknown) => link.update(id, patch))
  handle(l.remove, (ids: unknown) => link.remove(ids))

  const s = DIAGRAM_CHANNELS.scenario
  handle(s.create, (projectId: unknown, input: unknown) => scenario.create(projectId, input))
  handle(s.update, (id: unknown, patch: unknown) => scenario.update(id, patch))
  handle(s.remove, (id: unknown, policy: unknown) => scenario.remove(id, policy))
  handle(s.setSteps, (id: unknown, steps: unknown) => scenario.setSteps(id, steps))

  const h = DIAGRAM_CHANNELS.history
  handle(h.restore, (projectId: unknown, bundle: unknown) => history.restore(projectId, bundle))

  const y = DIAGRAM_CHANNELS.yaml
  handle(y.export, (projectId: unknown) => yaml.export(projectId))
  handle(y.preview, (projectId: unknown, text: unknown, options: unknown) =>
    yaml.preview(projectId, text, options)
  )
  handle(y.apply, (projectId: unknown, text: unknown, options: unknown) =>
    yaml.apply(projectId, text, options)
  )

  handle(y.pickFile, async () => {
    const file = await (extras.pickImportFile ?? pickImportFile)()
    if (file === null) throw new DiagramError('CANCELLED', 'No file chosen')
    return yaml.readFile(file)
  })
  handle(y.previewNew, (text: unknown) => yaml.previewNew(text))
  handle(y.applyNew, (name: unknown, text: unknown) => yaml.applyNew(name, text))

  const ex = DIAGRAM_CHANNELS.export
  handle(ex.mermaid, (projectId: unknown) => exporter.mermaid(projectId))
  handle(ex.jsonCanvas, (projectId: unknown) => exporter.jsonCanvas(projectId))
  handle(ex.png, (projectId: unknown, dataUrl: unknown) => exporter.png(projectId, dataUrl))
  handle(ex.openFolder, () => exporter.openFolder())

  const im = DIAGRAM_CHANNELS.image
  handle(im.pick, async (nodeId: unknown) => {
    const files = await (extras.pickImages ?? pickImageFiles)()
    if (files.length === 0) throw new DiagramError('CANCELLED', 'No image chosen')
    return image.addFromPaths(nodeId, files)
  })
  handle(im.addFromPaths, (nodeId: unknown, paths: unknown) => image.addFromPaths(nodeId, paths))
  handle(im.addFromBytes, (nodeId: unknown, name: unknown, bytes: unknown) =>
    image.addFromBytes(nodeId, name, bytes)
  )
  handle(im.addFromClipboard, (nodeId: unknown) => image.addFromClipboard(nodeId))
  handle(im.update, (id: unknown, patch: unknown) => image.update(id, patch))
  handle(im.remove, (id: unknown) => image.remove(id))
  handle(im.reorder, (nodeId: unknown, ids: unknown) => image.reorder(nodeId, ids))
  handle(im.sweep, (projectId: unknown) => image.sweep(projectId))

  const pn = DIAGRAM_CHANNELS.pin
  handle(pn.create, (imageId: unknown, input: unknown) => pin.create(imageId, input))
  handle(pn.update, (id: unknown, patch: unknown) => pin.update(id, patch))
  handle(pn.remove, (id: unknown) => pin.remove(id))
  handle(pn.reorder, (imageId: unknown, ids: unknown) => pin.reorder(imageId, ids))

  return () => {
    setImageContext(null)
    for (const channel of channels) ipcMain.removeHandler(channel)
  }
}

async function pickImageFiles(): Promise<string[]> {
  const { BrowserWindow, dialog } = await import('electron')
  const parent = BrowserWindow.getFocusedWindow()
  const options = {
    properties: ['openFile' as const, 'multiSelections' as const],
    filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

async function pickImportFile(): Promise<string | null> {
  const { BrowserWindow, dialog } = await import('electron')
  const parent = BrowserWindow.getFocusedWindow()
  const options = {
    properties: ['openFile' as const],
    filters: [
      { name: 'Flowmap YAML, Mermaid', extensions: ['yaml', 'yml', 'mmd', 'mermaid', 'md', 'txt'] },
      { name: 'Mọi file', extensions: ['*'] }
    ]
  }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  const chosen = result.filePaths[0]
  return result.canceled || !chosen ? null : chosen
}
