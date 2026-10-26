import { create } from 'zustand'
import type { KhoHealth, KhoStatus } from '../../shared/api'
import type {
  IpcResult,
  ProjectData,
  ProjectSettings,
  ProjectSummary,
  Theme
} from '../../shared/diagram/types'
import { errorText, IpcError, unwrap } from './errors'

export type SaveState = 'saved' | 'saving'

/** A message at the lower right. `info` is a result (green rim), `error` a failure (red rim). */
export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
  /** One button next to the text, for example "Mở thư mục". */
  action?: { label: string; run: () => void }
}

export interface ToastOptions {
  kind?: 'info' | 'error'
  action?: { label: string; run: () => void }
}

interface ShellState {
  ready: boolean
  kho: KhoStatus | null
  health: KhoHealth
  projects: ProjectSummary[]
  current: ProjectData | null
  theme: Theme
  saveState: SaveState
  toast: Toast | null

  init(): Promise<() => void>
  createKho(): Promise<void>
  openKho(): Promise<void>
  openRecent(root: string): Promise<void>
  refreshProjects(): Promise<void>
  /** Resolves to an error text for the dialog, or null on success. */
  createProject(name: string): Promise<string | null>
  renameProject(id: number, name: string): Promise<string | null>
  removeProject(id: number): Promise<string | null>
  openProject(id: number): Promise<void>
  closeProject(): Promise<void>
  setTheme(theme: Theme): void
  saveSettings(patch: Partial<ProjectSettings>): void
  showError(text: string): void
  showToast(text: string, options?: ToastOptions): void
  dismissToast(): void
}

let toastId = 0
let pendingSaves = 0
const api = () => window.api

function messageOf(error: unknown): string {
  return errorText(error instanceof IpcError ? error.code : 'INTERNAL')
}

export const useShell = create<ShellState>((set, get) => {
  const fail = (error: unknown) => get().showError(messageOf(error))

  /** Apply a new Kho status: reset the project list and the open project. */
  async function applyKho(status: KhoStatus) {
    set({ kho: status, current: null, projects: [], health: status.health })
    await get().refreshProjects()
  }

  async function runKhoCommand(command: () => Promise<IpcResult<KhoStatus>>) {
    try {
      const result = await command()
      if (!result.ok && result.code === 'CANCELLED') return
      await applyKho(unwrap(result))
    } catch (error) {
      fail(error)
    }
  }

  return {
    ready: false,
    kho: null,
    health: 'ok',
    projects: [],
    current: null,
    theme: 'dark',
    saveState: 'saved',
    toast: null,

    async init() {
      const off = api().shell.kho.onHealth((health) => {
        set({ health })
        // Data may have changed while the Kho was away.
        if (health === 'ok') void get().refreshProjects()
      })
      try {
        const status = await api().shell.kho.status()
        set({ kho: status, health: status.health })
        if (status.root) {
          await get().refreshProjects()
          const last = status.lastProjectId
          if (last !== null && get().projects.some((p) => p.id === last)) {
            await get().openProject(last)
          }
        }
      } catch (error) {
        fail(error)
      } finally {
        set({ ready: true })
      }
      return off
    },

    createKho: () => runKhoCommand(() => api().shell.kho.create()),
    openKho: () => runKhoCommand(() => api().shell.kho.open()),
    openRecent: (root) => runKhoCommand(() => api().shell.kho.openRecent(root)),

    async refreshProjects() {
      if (!get().kho?.root) return
      try {
        set({ projects: unwrap(await api().diagram.project.list()) })
      } catch (error) {
        fail(error)
      }
    },

    async createProject(name) {
      try {
        unwrap(await api().diagram.project.create(name))
        await get().refreshProjects()
        return null
      } catch (error) {
        return messageOf(error)
      }
    },

    async renameProject(id, name) {
      try {
        unwrap(await api().diagram.project.rename(id, name))
        await get().refreshProjects()
        return null
      } catch (error) {
        return messageOf(error)
      }
    },

    async removeProject(id) {
      try {
        unwrap(await api().diagram.project.remove(id))
        await get().refreshProjects()
        return null
      } catch (error) {
        return messageOf(error)
      }
    },

    async openProject(id) {
      try {
        const data = unwrap(await api().diagram.project.load(id))
        set({ current: data, theme: data.settings.theme })
        await api().shell.kho.setLastProject(id)
      } catch (error) {
        fail(error)
        await get().refreshProjects()
      }
    },

    async closeProject() {
      set({ current: null })
      await api().shell.kho.setLastProject(null)
      await get().refreshProjects()
    },

    setTheme(theme) {
      set({ theme })
      get().saveSettings({ theme })
    },

    /** Autosave (FR-DA-04): the top bar shows "Đang lưu" while a call is pending. */
    saveSettings(patch) {
      const current = get().current
      if (!current) return
      pendingSaves += 1
      set({
        saveState: 'saving',
        current: { ...current, settings: { ...current.settings, ...patch } }
      })
      void api()
        .diagram.project.saveSettings(current.project.id, patch)
        .then((result) => unwrap(result))
        .catch(fail)
        .finally(() => {
          pendingSaves -= 1
          if (pendingSaves === 0) set({ saveState: 'saved' })
        })
    },

    showError(text) {
      get().showToast(text, { kind: 'error' })
    },

    showToast(text, options = {}) {
      toastId += 1
      set({
        toast: {
          id: toastId,
          text,
          kind: options.kind ?? 'error',
          ...(options.action ? { action: options.action } : {})
        }
      })
    },

    dismissToast() {
      set({ toast: null })
    }
  }
})
