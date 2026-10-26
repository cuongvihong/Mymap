import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { normalize, slugify } from '../../../shared/diagram/normalize'
import {
  parseSettings,
  validateSettingsPatch,
  validateViewport
} from '../../../shared/diagram/settings'
import {
  PROJECT_NAME_MAX,
  type ProjectData,
  type ProjectInfo,
  type ProjectSettings,
  type ProjectSummary,
  type Viewport
} from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import { loadProjectData } from './data'
import * as repo from '../repo/projects'

export interface ProjectServiceOptions {
  /** Injectable clock for tests. */
  now?: () => Date
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `20261024-203500`, used as the suffix of a folder moved to thung-rac/. */
export function trashStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export const formatCode = (code: number): string => String(code).padStart(4, '0')

/** Highest project code found in folder names under a directory, 0 when the directory is missing. */
function maxCodeInFolders(dir: string): number {
  if (!existsSync(dir)) return 0
  let max = 0
  for (const name of readdirSync(dir)) {
    const m = /^(\d{4,})-/.exec(name)
    if (m?.[1]) max = Math.max(max, Number(m[1]))
  }
  return max
}

export function createProjectService(ctx: DiagramContext, options: ProjectServiceOptions = {}) {
  const { db, khoRoot, logger } = ctx
  const now = options.now ?? (() => new Date())
  const iso = () => now().toISOString()

  function validateName(raw: unknown, selfId: number | null): { name: string; norm: string } {
    if (typeof raw !== 'string') throw new DiagramError('INVALID_ARGUMENT', 'name must be a string')
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) throw new DiagramError('NAME_EMPTY', 'Project name is empty')
    if ([...name].length > PROJECT_NAME_MAX) {
      throw new DiagramError('NAME_TOO_LONG', `Project name is longer than ${PROJECT_NAME_MAX}`)
    }
    const norm = normalize(name)
    const existing = repo.findIdByNameNorm(db, norm)
    if (existing !== null && existing !== selfId) {
      throw new DiagramError('NAME_DUPLICATE', 'Another project has the same name')
    }
    return { name, norm }
  }

  function require(id: unknown): repo.ProjectRecord {
    if (typeof id !== 'number' || !Number.isInteger(id)) {
      throw new DiagramError('INVALID_ARGUMENT', 'id must be an integer')
    }
    const record = repo.getProject(db, id)
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return record
  }

  function summary(id: number): ProjectSummary {
    const found = repo.listProjects(db).find((p) => p.id === id)
    if (!found) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return found
  }

  /** Codes always grow. A code is never reused while its folder exists in du-an/ or thung-rac/. */
  function nextCode(): number {
    return (
      Math.max(
        repo.maxCode(db),
        maxCodeInFolders(join(khoRoot, 'du-an')),
        maxCodeInFolders(join(khoRoot, 'thung-rac'))
      ) + 1
    )
  }

  return {
    list(): ProjectSummary[] {
      return repo.listProjects(db)
    },

    create(rawName: unknown): ProjectSummary {
      const { name, norm } = validateName(rawName, null)
      const code = nextCode()
      const folder = `du-an/${formatCode(code)}-${slugify(name)}`
      const absolute = join(khoRoot, folder)
      mkdirSync(join(absolute, 'anh'), { recursive: true })
      try {
        const id = repo.insertProject(db, { code, name, nameNorm: norm, folder, now: iso() })
        logger.info('project created', { id, code })
        return summary(id)
      } catch (error) {
        rmSync(absolute, { recursive: true, force: true })
        throw error
      }
    },

    rename(id: unknown, rawName: unknown): ProjectSummary {
      const record = require(id)
      const { name, norm } = validateName(rawName, record.id)
      repo.updateName(db, record.id, name, norm, iso())
      logger.info('project renamed', { id: record.id })
      return summary(record.id)
    },

    /** Moves the folder into thung-rac/ first, then deletes the rows. The folder is never deleted for good. */
    remove(id: unknown): { trashFolder: string | null } {
      const record = require(id)
      const source = join(khoRoot, record.folder)
      let trashFolder: string | null = null
      let target: string | null = null
      if (existsSync(source) && statSync(source).isDirectory()) {
        const base = record.folder.split('/').pop() as string
        trashFolder = `thung-rac/${base}_${trashStamp(now())}`
        target = join(khoRoot, trashFolder)
        mkdirSync(join(khoRoot, 'thung-rac'), { recursive: true })
        renameSync(source, target)
      }
      try {
        repo.deleteProject(db, record.id)
      } catch (error) {
        if (target) renameSync(target, source)
        throw error
      }
      logger.info('project removed', { id: record.id, trashed: trashFolder !== null })
      return { trashFolder }
    },

    /** Everything of the project in one call (TDD 10). */
    load(id: unknown): ProjectData {
      return loadProjectData(db, require(id))
    },

    /** `docsRoot` comes from a folder dialog in ipc.ts. Null clears it. */
    setDocsRoot(id: unknown, docsRoot: string | null): ProjectInfo {
      const record = require(id)
      if (docsRoot !== null) {
        if (
          typeof docsRoot !== 'string' ||
          !existsSync(docsRoot) ||
          !statSync(docsRoot).isDirectory()
        ) {
          throw new DiagramError('DOCS_ROOT_INVALID', 'Docs folder does not exist')
        }
      }
      repo.updateDocsRoot(db, record.id, docsRoot, iso())
      return repo.toInfo(require(record.id))
    },

    saveViewport(id: unknown, viewport: unknown): null {
      const record = require(id)
      if (!validateViewport(viewport))
        throw new DiagramError('VIEWPORT_INVALID', 'Invalid viewport')
      const { x, y, zoom } = viewport as Viewport
      repo.updateViewport(db, record.id, JSON.stringify({ x, y, zoom }))
      return null
    },

    saveSettings(id: unknown, patch: unknown): ProjectSettings {
      const record = require(id)
      const problem = validateSettingsPatch(patch)
      if (problem) throw new DiagramError('SETTINGS_INVALID', problem)
      const merged = {
        ...parseSettings(record.settingsJson),
        ...(patch as Partial<ProjectSettings>)
      }
      repo.updateSettings(db, record.id, JSON.stringify(merged))
      return merged
    }
  }
}

export type ProjectService = ReturnType<typeof createProjectService>
