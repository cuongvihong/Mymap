import type { DiagramApi, IpcResult } from './diagram/types'

/** Data returned by window.api.app.getInfo(). */
export interface AppInfo {
  version: string
  appDir: string
  /** Raw Node platform: 'win32', 'linux', 'darwin'. */
  platform: string
  /** Human readable operating system name. */
  osName: string
  arch: string
  isDev: boolean
}

export interface AppApi {
  getInfo(): Promise<AppInfo>
}

/** Codes returned by the shell, next to the diagram codes. */
export const KHO_ERROR_CODES = [
  'KHO_INVALID',
  'KHO_NOT_EMPTY',
  'KHO_EXISTS',
  'KHO_NOT_ALLOWED',
  'CANCELLED',
  'INTERNAL'
] as const
export type KhoErrorCode = (typeof KHO_ERROR_CODES)[number]

export type KhoHealth = 'ok' | 'lost'

export interface KhoStatus {
  /** Absolute path of the open Kho, null when none is open. */
  root: string | null
  /** Recently opened Kho folders, newest first. */
  recent: string[]
  health: KhoHealth
  /** Project that was open last time in this Kho. */
  lastProjectId: number | null
}

export interface KhoApi {
  status(): Promise<KhoStatus>
  /** Folder dialog, then creates a Kho in the chosen empty folder and opens it. */
  create(): Promise<IpcResult<KhoStatus>>
  /** Folder dialog, then opens the chosen Kho. */
  open(): Promise<IpcResult<KhoStatus>>
  /** Opens a Kho from the recent list. Paths outside that list are refused. */
  openRecent(root: string): Promise<IpcResult<KhoStatus>>
  setLastProject(id: number | null): Promise<void>
  /** Called when the Kho disappears or comes back. Returns the unsubscribe function. */
  onHealth(listener: (health: KhoHealth) => void): () => void
}

export interface ShellApi {
  kho: KhoApi
}

/** Everything the preload script exposes on window.api. */
export interface MapAppApi {
  app: AppApi
  shell: ShellApi
  diagram: DiagramApi
}

/** IPC channels owned by the shell. Diagram channels live in shared/diagram/types.ts and start with `diagram:`. */
export const SHELL_CHANNELS = {
  appInfo: 'shell:app-info',
  kho: {
    status: 'shell:kho:status',
    create: 'shell:kho:create',
    open: 'shell:kho:open',
    openRecent: 'shell:kho:open-recent',
    setLastProject: 'shell:kho:set-last-project',
    health: 'shell:kho:health'
  }
} as const
