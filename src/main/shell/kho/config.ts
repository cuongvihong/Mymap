import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const RECENT_KHO_MAX = 8

/** Content of `<appDir>/config.json` (TDD 4). */
export interface AppConfig {
  version: 1
  lastKho: string | null
  recentKho: string[]
  /** Project that was open last, by Kho path. */
  lastProject: Record<string, number>
}

export const defaultConfig = (): AppConfig => ({
  version: 1,
  lastKho: null,
  recentKho: [],
  lastProject: {}
})

/** Read the config. A missing or damaged file gives the default, it never throws. */
export function loadConfig(file: string): AppConfig {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return defaultConfig()
  }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lastProject: Record<string, number> = {}
  if (o['lastProject'] && typeof o['lastProject'] === 'object') {
    for (const [k, v] of Object.entries(o['lastProject'] as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isInteger(v)) lastProject[k] = v
    }
  }
  return {
    version: 1,
    lastKho: typeof o['lastKho'] === 'string' ? o['lastKho'] : null,
    recentKho: Array.isArray(o['recentKho'])
      ? o['recentKho'].filter((p): p is string => typeof p === 'string').slice(0, RECENT_KHO_MAX)
      : [],
    lastProject
  }
}

/** Write through a temporary file so a power cut cannot leave half a file. */
export function saveConfig(file: string, config: AppConfig): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8')
  renameSync(tmp, file)
}

export function rememberKho(config: AppConfig, root: string): AppConfig {
  const recent = [root, ...config.recentKho.filter((p) => p !== root)].slice(0, RECENT_KHO_MAX)
  return { ...config, lastKho: root, recentKho: recent }
}

export function setLastProject(config: AppConfig, root: string, id: number | null): AppConfig {
  const lastProject = { ...config.lastProject }
  if (id === null) delete lastProject[root]
  else lastProject[root] = id
  return { ...config, lastProject }
}
