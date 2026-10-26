import type { Database } from 'better-sqlite3'
import type { DiagramLogger } from '../../shared/diagram/types'

/**
 * The three things the shell hands to the module (TDD 1).
 * The module never opens the database, reads config.json or locates the Kho itself.
 */
export interface DiagramContext {
  db: Database
  /** Absolute path of the Kho folder. */
  khoRoot: string
  logger: DiagramLogger
}
