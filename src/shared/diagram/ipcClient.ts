import { DIAGRAM_CHANNELS, type DiagramApi } from './types'

/**
 * `ipcRenderer.invoke` of the host, or anything with the same shape. The host's preload passes it in,
 * so this file does not import Electron (TDD 11 step 4: the host adds `diagram` to its preload with
 * one call).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Invoke = (channel: string, ...args: any[]) => Promise<any>

const p = DIAGRAM_CHANNELS.project
const n = DIAGRAM_CHANNELS.node
const g = DIAGRAM_CHANNELS.group
const l = DIAGRAM_CHANNELS.link
const sc = DIAGRAM_CHANNELS.scenario
const f = DIAGRAM_CHANNELS.fs
const h = DIAGRAM_CHANNELS.history
const y = DIAGRAM_CHANNELS.yaml
const im = DIAGRAM_CHANNELS.image
const pn = DIAGRAM_CHANNELS.pin
const ex = DIAGRAM_CHANNELS.export
export function createDiagramApi(invoke: Invoke, pathOfFile: DiagramApi['pathOfFile']): DiagramApi {
  return {
    project: {
      list: () => invoke(p.list),
      create: (name) => invoke(p.create, name),
      rename: (id, name) => invoke(p.rename, id, name),
      remove: (id) => invoke(p.remove, id),
      load: (id) => invoke(p.load, id),
      setDocsRoot: (id) => invoke(p.setDocsRoot, id),
      saveViewport: (id, viewport) => invoke(p.saveViewport, id, viewport),
      saveSettings: (id, patch) => invoke(p.saveSettings, id, patch)
    },
    node: {
      create: (projectId, input) => invoke(n.create, projectId, input),
      update: (id, patch) => invoke(n.update, id, patch),
      remove: (ids) => invoke(n.remove, ids),
      impact: (ids) => invoke(n.impact, ids),
      move: (batch) => invoke(n.move, batch),
      setGroup: (ids, groupId) => invoke(n.setGroup, ids, groupId)
    },
    group: {
      create: (projectId, input) => invoke(g.create, projectId, input),
      update: (id, patch) => invoke(g.update, id, patch),
      remove: (id, keepNodes) => invoke(g.remove, id, keepNodes)
    },
    link: {
      create: (projectId, input) => invoke(l.create, projectId, input),
      update: (id, patch) => invoke(l.update, id, patch),
      remove: (ids) => invoke(l.remove, ids)
    },
    scenario: {
      create: (projectId, input) => invoke(sc.create, projectId, input),
      update: (id, patch) => invoke(sc.update, id, patch),
      remove: (id, childPolicy) => invoke(sc.remove, id, childPolicy),
      setSteps: (id, steps) => invoke(sc.setSteps, id, steps)
    },
    fs: {
      open: (nodeId) => invoke(f.open, nodeId),
      exists: (projectId, relPaths) => invoke(f.exists, projectId, relPaths),
      pick: (projectId) => invoke(f.pick, projectId)
    },
    history: {
      restore: (projectId, bundle) => invoke(h.restore, projectId, bundle)
    },
    yaml: {
      export: (projectId) => invoke(y.export, projectId),
      preview: (projectId, text, options) => invoke(y.preview, projectId, text, options),
      apply: (projectId, text, options) => invoke(y.apply, projectId, text, options),
      pickFile: () => invoke(y.pickFile),
      previewNew: (text) => invoke(y.previewNew, text),
      applyNew: (name, text) => invoke(y.applyNew, name, text)
    },
    export: {
      mermaid: (projectId) => invoke(ex.mermaid, projectId),
      jsonCanvas: (projectId) => invoke(ex.jsonCanvas, projectId),
      png: (projectId, dataUrl) => invoke(ex.png, projectId, dataUrl),
      openFolder: () => invoke(ex.openFolder)
    },
    image: {
      pick: (nodeId) => invoke(im.pick, nodeId),
      addFromPaths: (nodeId, paths) => invoke(im.addFromPaths, nodeId, paths),
      addFromBytes: (nodeId, name, bytes) => invoke(im.addFromBytes, nodeId, name, bytes),
      addFromClipboard: (nodeId) => invoke(im.addFromClipboard, nodeId),
      update: (id, patch) => invoke(im.update, id, patch),
      remove: (id) => invoke(im.remove, id),
      reorder: (nodeId, ids) => invoke(im.reorder, nodeId, ids),
      sweep: (projectId) => invoke(im.sweep, projectId)
    },
    pin: {
      create: (imageId, input) => invoke(pn.create, imageId, input),
      update: (id, patch) => invoke(pn.update, id, patch),
      remove: (id) => invoke(pn.remove, id),
      reorder: (imageId, ids) => invoke(pn.reorder, imageId, ids)
    },
    pathOfFile
  }
}
