import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ElkLike } from '../../../shared/diagram/autolayout'
import { projectToDoc } from '../../../shared/diagram/flowmap'
import { toJsonCanvas, type CanvasBlock } from '../../../shared/diagram/jsoncanvas'
import { estimatedSize, planLayout } from '../../../shared/diagram/layoutPlan'
import { docToMermaid } from '../../../shared/diagram/mermaid'
import { slugify } from '../../../shared/diagram/normalize'
import type { ExportResult } from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as projects from '../repo/projects'
import { loadProjectData } from './data'
import { intArg } from './fields'
import type { OpenPath } from './fs'

export interface ExportServiceOptions {
  openPath: OpenPath
  /** The layout engine for blocks without coordinates. The bundled ELK by default. */
  engine?: () => Promise<ElkLike>
}

/** Largest picture the PNG export accepts, in bytes. */
export const PNG_MAX_BYTES = 64 * 1024 * 1024

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

async function bundledElk(): Promise<ElkLike> {
  const mod = await import('elkjs/lib/elk.bundled.js')
  const Elk = mod.default as unknown as new () => ElkLike
  return new Elk()
}

/** Mermaid, JSON Canvas and PNG written to `<Kho>/xuat/` (FR-YM-06 to 08). */
export function createExportService(ctx: DiagramContext, options: ExportServiceOptions) {
  const { db, khoRoot, logger } = ctx
  const engine = options.engine ?? bundledElk

  const requireProject = (id: unknown): projects.ProjectRecord => {
    const record = projects.getProject(db, intArg(id, 'projectId'))
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return record
  }

  function write(record: projects.ProjectRecord, extension: string, content: string | Buffer) {
    mkdirSync(join(khoRoot, 'xuat'), { recursive: true })
    const file = `xuat/${slugify(record.name)}.${extension}`
    writeFileSync(join(khoRoot, file), content)
    return file
  }

  return {
    mermaid(projectId: unknown): ExportResult {
      const record = requireProject(projectId)
      const text = docToMermaid(projectToDoc(loadProjectData(db, record)))
      logger.info('mermaid exported', { id: record.id })
      return { file: write(record, 'mmd', text) }
    },

    /** Blocks that still have no coordinates are laid out first, so every node has a position. */
    async jsonCanvas(projectId: unknown): Promise<ExportResult> {
      const record = requireProject(projectId)
      const data = loadProjectData(db, record)
      const moves = await planLayout(await engine(), data, { kind: 'pending' })
      const at = new Map(moves.map((m) => [m.id, m]))
      const keyOf = new Map(data.nodes.map((n) => [n.id, n.key]))
      const blocks: CanvasBlock[] = data.nodes.map((n) => {
        const size = estimatedSize(n)
        const moved = at.get(n.id)
        return {
          id: n.key,
          type: n.type,
          code: n.code,
          title: n.title,
          body: n.body,
          fix: n.fixText,
          chips: n.chips,
          rect: { x: moved?.x ?? n.x, y: moved?.y ?? n.y, w: size.w, h: size.h }
        }
      })
      const canvas = toJsonCanvas({
        groups: data.groups.map((g) => ({
          id: g.key,
          title: g.title,
          members: data.nodes.filter((n) => n.groupId === g.id).map((n) => n.key),
          ...(g.frame ? { fallback: g.frame } : {})
        })),
        blocks,
        links: data.links.map((l) => ({
          id: l.key,
          from: keyOf.get(l.fromNode) as string,
          to: keyOf.get(l.toNode) as string,
          via: l.via,
          label: l.label
        }))
      })
      logger.info('json canvas exported', { id: record.id })
      return { file: write(record, 'canvas', `${JSON.stringify(canvas, null, 2)}\n`) }
    },

    /** The renderer draws the whole map to a PNG. Here only the picture is checked and saved. */
    png(projectId: unknown, dataUrl: unknown): ExportResult {
      const record = requireProject(projectId)
      const match =
        typeof dataUrl === 'string'
          ? /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
          : null
      if (!match)
        throw new DiagramError('EXPORT_IMAGE_INVALID', 'The picture is not a PNG data URL')
      const bytes = Buffer.from(match[1] as string, 'base64')
      if (bytes.length > PNG_MAX_BYTES || !PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
        throw new DiagramError('EXPORT_IMAGE_INVALID', 'The picture is not a valid PNG')
      }
      logger.info('png exported', { id: record.id })
      return { file: write(record, 'png', bytes) }
    },

    async openFolder(): Promise<null> {
      const folder = join(khoRoot, 'xuat')
      mkdirSync(folder, { recursive: true })
      const failure = await options.openPath(folder)
      if (failure) throw new DiagramError('EXPORT_OPEN_FAILED', 'The folder could not be opened')
      return null
    }
  }
}

export type ExportService = ReturnType<typeof createExportService>
