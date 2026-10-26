import { accessSync, constants } from 'node:fs'
import type { Database } from 'better-sqlite3'
import type { KhoHealth, KhoStatus } from '../../../shared/api'
import type { DiagramLogger } from '../../../shared/diagram/types'
import type { DiagramContext } from '../../diagram/context'
import { runDiagramMigrations } from '../../diagram/migrate'
import { registerDiagramIpc, type IpcMainLike } from '../../diagram/ipc'
import { backupDatabase } from './backup'
import { loadConfig, rememberKho, saveConfig, setLastProject, type AppConfig } from './config'
import { openDatabase } from './database'
import { createKho } from './createKho'
import { KhoError } from './errors'
import { isKho, khoPaths } from './paths'
import { resolveRoot } from './resolveRoot'
import { createWatchdog, type Watchdog } from './watchdog'

export interface KhoManagerDeps {
  appDir: string
  /** Absolute path of config.json. */
  configFile: string
  logger: DiagramLogger
  ipcMain: IpcMainLike
  /** Tells the renderer that the Kho was lost or came back. */
  emitHealth: (health: KhoHealth) => void
  now?: () => Date
  watchdogIntervalMs?: number
  /** Called once each time a Kho has been opened and its IPC is registered. Used by the dev seed. */
  onOpen?: (ctx: DiagramContext) => void
}

interface OpenKho {
  root: string
  db: Database
  disposeIpc: () => void
  watchdog: Watchdog
}

/**
 * Owns the open Kho: database connection, diagram IPC registration, config.json and the watchdog.
 * This is the only place where the shell hands the module its three inputs (db, khoRoot, logger).
 */
export class KhoManager {
  private open_: OpenKho | null = null
  private health: KhoHealth = 'ok'
  private config: AppConfig

  constructor(private readonly deps: KhoManagerDeps) {
    this.config = loadConfig(deps.configFile)
  }

  /** Open the Kho used last time, or the portable one. Failure is not an error, it shows the welcome screen. */
  startup(): KhoStatus {
    const { root } = resolveRoot(this.deps.appDir, this.config)
    if (root) {
      try {
        this.openRoot(root)
      } catch (error) {
        this.deps.logger.error('startup open failed', { reason: (error as Error).name })
      }
    }
    return this.status()
  }

  status(): KhoStatus {
    const root = this.open_?.root ?? null
    return {
      root,
      recent: this.config.recentKho,
      health: this.health,
      lastProjectId: root ? (this.config.lastProject[root] ?? null) : null
    }
  }

  /** Create a Kho in an empty folder and open it. */
  createAndOpen(root: string): KhoStatus {
    createKho(root)
    this.deps.logger.info('kho created')
    return this.openRoot(root)
  }

  openExisting(root: string): KhoStatus {
    return this.openRoot(root)
  }

  /** Only paths from the recent list are accepted, the renderer cannot make us open anything else. */
  openRecent(root: unknown): KhoStatus {
    if (typeof root !== 'string' || !this.config.recentKho.includes(root)) {
      throw new KhoError('KHO_NOT_ALLOWED', 'Path is not in the recent list')
    }
    return this.openRoot(root)
  }

  setLastProject(id: number | null): void {
    const root = this.open_?.root
    if (!root) return
    this.config = setLastProject(this.config, root, id)
    this.persist()
  }

  close(): void {
    this.teardown()
  }

  private openRoot(root: string): KhoStatus {
    if (!isKho(root)) throw new KhoError('KHO_INVALID', 'Folder is not a Kho')
    this.teardown()

    try {
      backupDatabase(root, (this.deps.now ?? (() => new Date()))())
    } catch (error) {
      // A failed backup must not stop the user from working.
      this.deps.logger.warn('backup failed', { reason: (error as Error).name })
    }

    const db = openDatabase(khoPaths(root).db)
    let disposeIpc: () => void
    try {
      const result = runDiagramMigrations(db)
      this.deps.logger.info('kho opened', { from: result.from, to: result.to })
      const ctx: DiagramContext = { db, khoRoot: root, logger: this.deps.logger }
      disposeIpc = registerDiagramIpc(this.deps.ipcMain, ctx)
      try {
        this.deps.onOpen?.(ctx)
      } catch (error) {
        // A failing dev hook must not stop the Kho from opening.
        this.deps.logger.warn('onOpen failed', { reason: (error as Error).name })
      }
    } catch (error) {
      db.close()
      throw error
    }

    const watchdog = createWatchdog({
      intervalMs: this.deps.watchdogIntervalMs,
      check: () => {
        accessSync(khoPaths(root).db, constants.R_OK | constants.W_OK)
        return true
      },
      onLost: () => this.setHealth('lost'),
      onRecovered: () => this.recover()
    })
    watchdog.start()

    this.open_ = { root, db, disposeIpc, watchdog }
    this.health = 'ok'
    this.config = rememberKho(this.config, root)
    this.persist()
    return this.status()
  }

  /** The Kho is reachable again: drop the stale connection, open a fresh one, register the IPC again. */
  private recover(): boolean {
    const current = this.open_
    if (!current) return true
    try {
      current.disposeIpc()
      try {
        current.db.close()
      } catch {
        // The old handle points at a vanished device, closing may fail.
      }
      const db = openDatabase(khoPaths(current.root).db)
      runDiagramMigrations(db)
      current.db = db
      current.disposeIpc = registerDiagramIpc(this.deps.ipcMain, {
        db,
        khoRoot: current.root,
        logger: this.deps.logger
      })
      this.setHealth('ok')
      return true
    } catch (error) {
      this.deps.logger.error('recover failed', { reason: (error as Error).name })
      // Returning false keeps the watchdog in the lost state, so the next tick tries again.
      return false
    }
  }

  private setHealth(health: KhoHealth): void {
    if (this.health === health) return
    this.health = health
    this.deps.logger.info('kho health', { health })
    this.deps.emitHealth(health)
  }

  private teardown(): void {
    const current = this.open_
    if (!current) return
    current.watchdog.stop()
    current.disposeIpc()
    try {
      current.db.close()
    } catch {
      // Nothing to do.
    }
    this.open_ = null
  }

  private persist(): void {
    try {
      saveConfig(this.deps.configFile, this.config)
    } catch (error) {
      this.deps.logger.warn('config save failed', { reason: (error as Error).name })
    }
  }
}
