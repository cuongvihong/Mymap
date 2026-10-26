import { existsSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import { intArg } from './fields'

/** Opens a path with the operating system (shell.openPath). Returns '' on success, a message on failure. */
export type OpenPath = (absolute: string) => Promise<string>

export interface FsServiceOptions {
  openPath: OpenPath
}

/**
 * Absolute path of a document, or null when `rel` would leave the documents folder.
 * The database only holds paths relative to docs_root (MASTER 4.5), so a value such as `..\x`
 * or an absolute path is refused instead of opened.
 */
export function resolveDoc(docsRoot: string, rel: string): string | null {
  if (!rel || isAbsolute(rel)) return null
  const full = resolve(docsRoot, rel)
  const back = relative(resolve(docsRoot), full)
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return null
  return full
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}

/** FR-KH-06: the module only opens documents, it never writes them. */
export function createFsService(ctx: DiagramContext, options: FsServiceOptions) {
  const { db, logger } = ctx

  function project(id: number) {
    const record = projects.getProject(db, id)
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return record
  }

  return {
    async open(nodeId: unknown): Promise<null> {
      const id = intArg(nodeId, 'nodeId')
      const node = nodes.getNode(db, id)
      if (!node) throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
      const record = project(node.projectId)
      if (!record.docsRoot) throw new DiagramError('FS_NO_ROOT', 'No documents folder')
      if (!node.fsFile) throw new DiagramError('FS_NOT_FOUND', 'Block has no source document')
      const full = resolveDoc(record.docsRoot, node.fsFile)
      if (!full) throw new DiagramError('FS_NOT_FOUND', 'Document path is not allowed')
      if (!isFile(full)) throw new DiagramError('FS_NOT_FOUND', 'Document file not found')
      const failure = await options.openPath(full)
      if (failure) {
        logger.warn('open document failed')
        throw new DiagramError('FS_OPEN_FAILED', 'The system could not open the file')
      }
      return null
    },

    /** Existence of each relative path under docs_root. Everything is false while no folder is set. */
    exists(projectId: unknown, relPaths: unknown): Record<string, boolean> {
      const record = project(intArg(projectId, 'projectId'))
      if (!Array.isArray(relPaths) || relPaths.some((p) => typeof p !== 'string')) {
        throw new DiagramError('INVALID_ARGUMENT', 'relPaths must be a list of strings')
      }
      const out: Record<string, boolean> = {}
      for (const rel of relPaths as string[]) {
        const full = record.docsRoot ? resolveDoc(record.docsRoot, rel) : null
        out[rel] = full !== null && isFile(full)
      }
      return out
    }
  }
}

export type FsService = ReturnType<typeof createFsService>
