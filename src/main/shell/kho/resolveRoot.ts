import { dirname } from 'node:path'
import type { AppConfig } from './config'
import { isKho } from './paths'

export interface ResolvedRoot {
  root: string | null
  source: 'last' | 'portable' | null
}

/**
 * Pick the Kho to open at start up (FR-DA-01).
 * 1. The Kho used last time, when it still exists.
 * 2. The folder that holds app/ (the portable layout, <Kho>/app), when it is a Kho.
 *    This is the case on a USB stick whose drive letter changed.
 * 3. None, the welcome screen asks the user.
 */
export function resolveRoot(
  appDir: string,
  config: AppConfig,
  check: (root: string) => boolean = isKho
): ResolvedRoot {
  if (config.lastKho && check(config.lastKho)) return { root: config.lastKho, source: 'last' }
  const portable = dirname(appDir)
  if (check(portable)) return { root: portable, source: 'portable' }
  return { root: null, source: null }
}
