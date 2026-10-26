import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Recursively list files with one of the given extensions. */
export function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out.sort()
}

export const readText = (file: string): string => readFileSync(file, 'utf8')

const IMPORT_PATTERNS = [
  /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g
]

/** Import specifiers that point into a `shell` folder (rule MASTER 4.4). */
export function findShellImports(source: string): string[] {
  const found: string[] = []
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const spec = match[1]
      if (spec && spec.split('/').includes('shell')) found.push(spec)
    }
  }
  return found
}

/** CSS imports or url() that point into a `shell` folder. */
export function findShellCssRefs(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(
    /(?:@import|composes:[^;]*from|url\()\s*['"]?([^'")\s;]+)/g
  )) {
    const spec = match[1]
    if (spec && spec.split('/').includes('shell')) found.push(spec)
  }
  return found
}

const CHANNEL_CALLS =
  /\b(?:ipcMain|ipcRenderer|ipc|webContents)\s*\.\s*(?:handle|handleOnce|on|once|invoke|send|sendSync|removeHandler)\(\s*(['"`])([^'"`]+)\1/g

/** IPC channel names that do not start with `diagram:` (TDD 7). */
export function findBadIpcChannels(source: string, prefix = 'diagram:'): string[] {
  const bad: string[] = []
  for (const match of source.matchAll(CHANNEL_CALLS)) {
    const channel = match[2]
    if (channel && !channel.startsWith(prefix)) bad.push(channel)
  }
  return bad
}

/** Custom properties DECLARED (not used) in a CSS file. */
export function declaredCssVars(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...clean.matchAll(/(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1] as string)
}

/** Custom properties declared from TypeScript: style objects and setProperty. */
export function declaredTsVars(source: string): string[] {
  const vars = [...source.matchAll(/['"](--[A-Za-z0-9_-]+)['"]\s*:/g)].map((m) => m[1] as string)
  for (const m of source.matchAll(/setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]/g)) {
    vars.push(m[1] as string)
  }
  return vars
}

export const notDgVar = (name: string): boolean => !name.startsWith('--dg-')
