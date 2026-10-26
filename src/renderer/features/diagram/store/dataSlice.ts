import {
  buildErrorReport,
  buildPrompt,
  projectToDoc,
  serializeFlowmap
} from '../../../../shared/diagram/flowmap'
import { planLayout, estimatedSize, type LayoutScope } from '../../../../shared/diagram/layoutPlan'
import { blockWidth } from '../../../../shared/diagram/frames'
import type { LayoutMove } from '../../../../shared/diagram/autolayout'
import type {
  DiagramApi,
  FlowmapIssue,
  IpcResult,
  NodeData,
  ProjectData,
  ProjectSummary,
  YamlPreview
} from '../../../../shared/diagram/types'
import { renderMapPng } from '../export/renderPng'
import { elkEngine, warmElk } from '../layout/elkClient'
import { diagramStrings as t } from '../strings'
import type { DiagramState, NoticeOptions } from './diagramStore'

/** What the import dialog (SCR-06) shows. */
export interface ImportDialogState {
  /** `merge` adds to the open project, `new` creates a project from the file (welcome screen). */
  mode: 'merge' | 'new'
  /** Where the text came from: a file, or the YAML panel. */
  source: 'file' | 'panel'
  fileName: string
  text: string
  /** Null while the first check runs. */
  preview: YamlPreview | null
  removeMissing: boolean
  name: string
  nameError: string | null
  busy: boolean
}

export interface DataSliceState {
  yamlOpen: boolean
  /** What the editor of the YAML panel holds. */
  yamlText: string
  /** The YAML of the project as it is now. The editor is "dirty" when it differs. */
  yamlBase: string
  yamlWidth: number
  /** Asks the editor to put the caret at a line. `seq` makes the same line count twice. */
  yamlJump: { line: number; col: number; seq: number } | null
  /** Lines of the editor text that the last check marked as errors. */
  yamlErrorLines: number[]
  importDialog: ImportDialogState | null
  layoutBusy: boolean
  exporting: boolean
}

export interface DataSliceActions {
  openYaml(): void
  closeYaml(): void
  toggleYaml(): void
  setYamlText(text: string): void
  /** The project changed: the generated YAML moves on, and so does the editor when it was clean. */
  syncYaml(base: string): void
  revertYaml(): void
  setYamlWidth(width: number): void
  jumpToYamlLine(line: number, col: number): void

  importFromFile(mode: 'merge' | 'new'): Promise<void>
  importFromPanel(): Promise<void>
  setImportRemoveMissing(value: boolean): Promise<void>
  setImportName(name: string): void
  closeImport(): void
  /** Applies the checked text. Returns the new project when the mode is `new`, else null. */
  confirmImport(): Promise<ProjectSummary | null>
  copyPrompt(): Promise<void>
  copyImportErrors(): Promise<void>
  goToImportError(issue: FlowmapIssue): void

  /** FR-BC-01. Waits for the engine, applies the moves as one step of undo. */
  autoLayout(scope: LayoutScope): Promise<void>
  /** Blocks without coordinates (after an import, or a file that was never laid out). */
  layoutPending(): Promise<void>

  exportAs(kind: 'yaml' | 'mermaid' | 'canvas' | 'png'): Promise<void>
  openExportFolder(): Promise<void>
}

export const DATA_EMPTY = {
  yamlOpen: false,
  yamlText: '',
  yamlBase: '',
  yamlJump: null,
  yamlErrorLines: [],
  importDialog: null,
  layoutBusy: false,
  exporting: false
} satisfies Partial<DataSliceState>

export const YAML_PANEL_DEFAULT_WIDTH = 460
export const YAML_PANEL_MIN_WIDTH = 320

export interface DataSliceContext {
  set(partial: Partial<DiagramState>): void
  get(): DiagramState
  api(): DiagramApi
  run<T>(call: Promise<IpcResult<T>>): Promise<T | null>
  /** Reports an error code to the shell. */
  fail(code: string): void
  notify(text: string, options?: NoticeOptions): void
  /** Writes moves, records one step of undo. */
  applyMoves(label: string, moves: readonly LayoutMove[]): Promise<void>
  /** Import cannot be undone, so the steps before it are dropped. */
  clearHistory(): void
  requestFit(): void
}

let seq = 0

/** Text of the project as Flowmap YAML, with the layout. Same text as the export file. */
export function yamlOf(data: ProjectData): string {
  return serializeFlowmap(projectToDoc(data))
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const done = document.execCommand('copy')
      area.remove()
      return done
    } catch {
      return false
    }
  }
}

const stripExtension = (name: string): string =>
  name.replace(/\.(flowmap\.)?(ya?ml|mmd|mermaid|md|txt)$/i, '')

const NAME_ERRORS: Record<string, string> = {
  NAME_EMPTY: t.importDialog.nameErrors.empty,
  NAME_TOO_LONG: t.importDialog.nameErrors.tooLong,
  NAME_DUPLICATE: t.importDialog.nameErrors.duplicate
}

const errorLinesOf = (preview: YamlPreview | null): number[] =>
  preview && !preview.ok
    ? [...new Set(preview.issues.filter((i) => i.severity === 'error').map((i) => i.line))]
    : []

export function createDataSlice(ctx: DataSliceContext): DataSliceActions {
  const { set, get, run, fail, notify } = ctx
  const api = ctx.api

  const dialog = (): ImportDialogState | null => get().importDialog
  const patchDialog = (patch: Partial<ImportDialogState>) => {
    const d = dialog()
    if (d) set({ importDialog: { ...d, ...patch } })
  }

  async function previewOf(
    mode: 'merge' | 'new',
    text: string,
    removeMissing: boolean
  ): Promise<YamlPreview | null> {
    const data = get().data
    if (mode === 'new') return run(api().yaml.previewNew(text))
    if (!data) return null
    return run(api().yaml.preview(data.project.id, text, { removeMissing }))
  }

  async function begin(
    mode: 'merge' | 'new',
    source: 'file' | 'panel',
    fileName: string,
    text: string
  ): Promise<void> {
    warmElk()
    set({
      importDialog: {
        mode,
        source,
        fileName,
        text,
        preview: null,
        removeMissing: false,
        name: stripExtension(fileName),
        nameError: null,
        busy: false
      }
    })
    const preview = await previewOf(mode, text, false)
    if (!preview) {
      set({ importDialog: null })
      return
    }
    const name = preview.ok && preview.projectName ? preview.projectName : stripExtension(fileName)
    patchDialog({ preview, name })
    // Errors of a file are shown in the panel, on the text that has them, so the user can fix them there.
    if (!preview.ok && mode === 'merge') {
      set({ yamlErrorLines: errorLinesOf(preview) })
      if (source === 'file') set({ yamlOpen: true, yamlText: text })
    } else {
      set({ yamlErrorLines: [] })
    }
  }

  /** Blocks of the scope that the engine has to place, with measured sizes when the canvas has them. */
  const sizeOf = (n: NodeData) => {
    const measured = get().sizes[n.id]
    const guess = estimatedSize(n)
    return { w: blockWidth(n.type), h: measured?.h ?? guess.h }
  }

  /** Blocks that have just appeared are measured a moment later. Give the canvas time to do it. */
  async function waitForSizes(ids: readonly number[], ms: number): Promise<void> {
    const until = Date.now() + ms
    while (Date.now() < until) {
      const sizes = get().sizes
      if (ids.every((id) => sizes[id])) return
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  async function layout(scope: LayoutScope, announce: boolean): Promise<void> {
    const data = get().data
    if (!data || get().layoutBusy) return
    set({ layoutBusy: true })
    try {
      const targets =
        scope.kind === 'all'
          ? data.nodes
          : scope.kind === 'pending'
            ? data.nodes.filter((n) => !n.hasLayout)
            : data.nodes.filter((n) => scope.ids.includes(n.id))
      if (targets.length === 0) {
        if (announce) notify(t.data.layoutNothing, { kind: 'info' })
        return
      }
      performance.mark('dg-layout-start')
      await waitForSizes(
        targets.map((n) => n.id),
        1500
      )
      performance.mark('dg-layout-sized')
      const now = get().data ?? data
      const moves = await planLayout(elkEngine(), now, scope, sizeOf)
      performance.mark('dg-layout-planned')
      await ctx.applyMoves(t.data.layoutLabel, moves)
      performance.mark('dg-layout-written')
      ctx.requestFit()
      if (announce) notify(t.data.layoutDone.replace('{n}', String(moves.length)), { kind: 'info' })
    } catch {
      notify(t.data.layoutFailed)
    } finally {
      set({ layoutBusy: false })
    }
  }

  return {
    openYaml() {
      set({ yamlOpen: true })
    },
    closeYaml() {
      set({ yamlOpen: false })
    },
    toggleYaml() {
      set({ yamlOpen: !get().yamlOpen })
    },
    setYamlText(text) {
      set({ yamlText: text })
    },
    syncYaml(base) {
      const { yamlText, yamlBase } = get()
      set({ yamlBase: base, ...(yamlText === yamlBase ? { yamlText: base } : {}) })
    },
    revertYaml() {
      set({ yamlText: get().yamlBase, yamlErrorLines: [] })
    },
    setYamlWidth(width) {
      set({ yamlWidth: Math.max(YAML_PANEL_MIN_WIDTH, Math.round(width)) })
    },
    jumpToYamlLine(line, col) {
      seq += 1
      set({ yamlOpen: true, yamlJump: { line, col, seq } })
    },

    async importFromFile(mode) {
      let file: { name: string; text: string } | null = null
      try {
        const result = await api().yaml.pickFile()
        if (!result.ok) {
          if (result.code !== 'CANCELLED') fail(result.code)
          return
        }
        file = result.data
      } catch {
        fail('INTERNAL')
        return
      }
      await begin(mode, 'file', file.name, file.text)
    },

    async importFromPanel() {
      const { yamlText } = get()
      await begin('merge', 'panel', 'YAML', yamlText)
    },

    async setImportRemoveMissing(value) {
      const d = dialog()
      if (!d || d.mode !== 'merge') return
      patchDialog({ removeMissing: value })
      const preview = await previewOf('merge', d.text, value)
      if (preview) patchDialog({ preview })
    },

    setImportName(name) {
      patchDialog({ name, nameError: null })
    },

    closeImport() {
      set({ importDialog: null })
    },

    goToImportError(issue) {
      const d = dialog()
      if (!d || d.mode !== 'merge') return
      set({ importDialog: null })
      get().jumpToYamlLine(issue.line, issue.col)
    },

    async confirmImport() {
      const d = dialog()
      if (!d || !d.preview || !d.preview.ok || d.busy) return null
      if (d.mode === 'new') {
        const name = d.name.trim()
        if (name === '') {
          patchDialog({ nameError: t.importDialog.nameErrors.empty })
          return null
        }
        patchDialog({ busy: true })
        const result = await api().yaml.applyNew(name, d.text)
        if (!result.ok) {
          const text = NAME_ERRORS[result.code]
          if (text) patchDialog({ busy: false, nameError: text })
          else {
            patchDialog({ busy: false })
            fail(result.code)
          }
          return null
        }
        set({ importDialog: null })
        notify(t.importDialog.created.replace('{name}', result.data.project.name), { kind: 'info' })
        return result.data.project
      }
      const data = get().data
      if (!data) return null
      patchDialog({ busy: true })
      const applied = await run(
        api().yaml.apply(data.project.id, d.text, { removeMissing: d.removeMissing })
      )
      if (!applied) {
        patchDialog({ busy: false })
        return null
      }
      set({ importDialog: null, yamlErrorLines: [] })
      ctx.clearHistory()
      await get().reload()
      const next = get().data
      if (next) {
        const text = yamlOf(next)
        set({ yamlBase: text, yamlText: text })
      }
      const s = applied.summary
      notify(
        t.importDialog.applied
          .replace('{add}', String(s.add.nodes))
          .replace('{update}', String(s.update.nodes))
          .replace('{remove}', String(s.remove.nodes)),
        { kind: 'info' }
      )
      await layout({ kind: 'pending' }, false)
      ctx.requestFit()
      return null
    },

    async copyPrompt() {
      const done = await copyText(buildPrompt())
      notify(done ? t.data.promptCopied : t.data.copyFailed, { kind: done ? 'info' : 'error' })
    },

    async copyImportErrors() {
      const d = dialog()
      if (!d?.preview || d.preview.ok) return
      const messages = d.preview.issues.filter((i) => i.severity === 'error').map((i) => i.message)
      const done = await copyText(buildErrorReport(messages))
      notify(done ? t.importDialog.errorsCopied : t.data.copyFailed, {
        kind: done ? 'info' : 'error'
      })
    },

    autoLayout: (scope) => layout(scope, true),
    layoutPending: () => layout({ kind: 'pending' }, false),

    async exportAs(kind) {
      const data = get().data
      if (!data || get().exporting) return
      if (data.nodes.length === 0) {
        notify(t.data.exportEmpty)
        return
      }
      set({ exporting: true })
      try {
        let result: { file: string } | null = null
        const id = data.project.id
        if (kind === 'yaml') result = await run(api().yaml.export(id))
        else if (kind === 'mermaid') result = await run(api().export.mermaid(id))
        else if (kind === 'canvas') result = await run(api().export.jsonCanvas(id))
        else {
          const url = await renderMapPng(data, get().sizes)
          if (!url) {
            notify(t.data.exportPngFailed)
            return
          }
          result = await run(api().export.png(id, url))
        }
        if (result) {
          notify(t.data.exportDone.replace('{file}', result.file), {
            kind: 'info',
            action: { label: t.data.openFolder, run: () => void get().openExportFolder() }
          })
        }
      } catch {
        fail('INTERNAL')
      } finally {
        set({ exporting: false })
      }
    },

    async openExportFolder() {
      await run(api().export.openFolder())
    }
  }
}
