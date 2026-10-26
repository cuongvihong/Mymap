import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  readFileSync,
  writeFileSync,
  copyFileSync
} from 'node:fs'
import { basename, extname, join } from 'node:path'
import { imageDimensions } from '../../../shared/diagram/imagesize'
import {
  IMAGE_LIMITS,
  imageExtension,
  thumbPath,
  type ImageExtension
} from '../../../shared/diagram/imagerules'
import type { ImageData, ImagePatch } from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as images from '../repo/images'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import { intArg, intList, plainObject, text } from './fields'
import { trashStamp } from './project'

/** What the shell supplies for the parts that need Electron (TDD 8.7). */
export interface ImageHost {
  /** PNG bytes of a thumbnail with the longest side `side`, or null when the format cannot be decoded. */
  thumbnail?: (bytes: Buffer, side: number) => Buffer | null | Promise<Buffer | null>
  /** PNG bytes of the image on the system clipboard, or null. */
  readClipboard?: () => Buffer | null | Promise<Buffer | null>
}

export interface ImageServiceOptions {
  host?: ImageHost
  now?: () => Date
}

interface Prepared {
  ext: 'png' | 'jpg' | 'webp' | 'gif'
  bytes: Buffer
  width: number
  height: number
  caption: string
}

const normalizeExt = (ext: ImageExtension): Prepared['ext'] => (ext === 'jpeg' ? 'jpg' : ext)

/** Images and the files behind them (FR-AN-01, TDD 8.7). */
export function createImageService(ctx: DiagramContext, options: ImageServiceOptions = {}) {
  const { db, khoRoot, logger } = ctx
  const host = options.host ?? {}
  const now = options.now ?? (() => new Date())

  function requireNode(id: unknown) {
    const node = nodes.getNode(db, intArg(id, 'nodeId'))
    if (!node) throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
    return node
  }

  function requireImage(id: unknown) {
    const image = images.getImage(db, intArg(id, 'id'))
    if (!image) throw new DiagramError('IMAGE_NOT_FOUND', 'Image not found')
    return image
  }

  function projectFolder(projectId: number): string {
    const record = projects.getProject(db, projectId)
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return join(khoRoot, record.folder)
  }

  function captionOf(name: string): string {
    const base = name.slice(0, name.length - extname(name).length).trim()
    return [...(base || 'Ảnh')].slice(0, 300).join('')
  }

  /** Checks one image: format by extension, size limit, and that the bytes really are that image. */
  function prepare(fileName: string, bytes: Buffer, caption: string): Prepared {
    const ext = imageExtension(fileName)
    if (!ext) throw new DiagramError('IMAGE_FORMAT', 'Only PNG, JPG, WEBP and GIF are accepted')
    if (bytes.length > IMAGE_LIMITS.maxBytes)
      throw new DiagramError('IMAGE_TOO_LARGE', 'Image is larger than 15 MB')
    const size = imageDimensions(bytes)
    if (!size) throw new DiagramError('IMAGE_UNREADABLE', 'The file is not a readable image')
    return { ext: normalizeExt(ext), bytes, width: size.width, height: size.height, caption }
  }

  function checkRoom(nodeId: number, adding: number) {
    if (adding < 1) throw new DiagramError('INVALID_ARGUMENT', 'Nothing to add')
    if (images.countImages(db, nodeId) + adding > IMAGE_LIMITS.maxPerBlock)
      throw new DiagramError('IMAGE_LIMIT', 'A block holds at most 8 images')
  }

  /** Writes the files, then the rows. A failing row removes the files again. */
  async function store(nodeId: number, projectId: number, items: Prepared[]): Promise<ImageData[]> {
    const dir = join(projectFolder(projectId), 'anh')
    mkdirSync(dir, { recursive: true })
    const written: string[] = []
    try {
      const rows: { item: Prepared; relPath: string }[] = []
      for (const item of items) {
        const relPath = `anh/${randomUUID()}.${item.ext}`
        const absolute = join(projectFolder(projectId), relPath)
        writeFileSync(absolute, item.bytes)
        written.push(absolute)
        try {
          const thumb = (await host.thumbnail?.(item.bytes, IMAGE_LIMITS.thumbSide)) ?? null
          if (thumb) {
            const thumbAbsolute = join(projectFolder(projectId), thumbPath(relPath))
            writeFileSync(thumbAbsolute, thumb)
            written.push(thumbAbsolute)
          }
        } catch {
          // A missing thumbnail is fine: the protocol serves the original instead.
          logger.warn('thumbnail failed')
        }
        rows.push({ item, relPath })
      }
      const run = db.transaction(() => {
        let order = images.nextImageOrder(db, nodeId)
        return rows.map(({ item, relPath }) => {
          const data: Omit<ImageData, 'id'> = {
            nodeId,
            relPath,
            width: item.width,
            height: item.height,
            caption: item.caption,
            sortOrder: order++
          }
          return { id: images.insertImage(db, data), ...data }
        })
      })
      const out = run()
      logger.info('images added', { count: out.length })
      return out
    } catch (error) {
      for (const file of written) rmSync(file, { force: true })
      throw error
    }
  }

  return {
    async addFromPaths(rawNodeId: unknown, rawPaths: unknown): Promise<ImageData[]> {
      const node = requireNode(rawNodeId)
      if (!Array.isArray(rawPaths) || rawPaths.length === 0)
        throw new DiagramError('INVALID_ARGUMENT', 'absPaths must be a non empty list')
      const paths = rawPaths.map((p) => text(p, 'path', 1024, true))
      checkRoom(node.id, paths.length)
      // Everything is checked before the first file is copied: a bad file adds nothing.
      const items = paths.map((path) => {
        if (!imageExtension(path))
          throw new DiagramError('IMAGE_FORMAT', 'Only PNG, JPG, WEBP and GIF are accepted')
        let size: number
        try {
          const st = statSync(path)
          if (!st.isFile()) throw new Error('not a file')
          size = st.size
        } catch {
          throw new DiagramError('IMAGE_UNREADABLE', 'The file cannot be read')
        }
        if (size > IMAGE_LIMITS.maxBytes)
          throw new DiagramError('IMAGE_TOO_LARGE', 'Image is larger than 15 MB')
        let bytes: Buffer
        try {
          bytes = readFileSync(path)
        } catch {
          throw new DiagramError('IMAGE_UNREADABLE', 'The file cannot be read')
        }
        return prepare(path, bytes, captionOf(basename(path)))
      })
      return await store(node.id, node.projectId, items)
    },

    async addFromBytes(
      rawNodeId: unknown,
      rawName: unknown,
      rawBytes: unknown
    ): Promise<ImageData> {
      const node = requireNode(rawNodeId)
      const name = text(rawName, 'fileName', 260, true)
      if (!(rawBytes instanceof Uint8Array))
        throw new DiagramError('INVALID_ARGUMENT', 'bytes must be binary data')
      checkRoom(node.id, 1)
      const item = prepare(name, Buffer.from(rawBytes), captionOf(name))
      return (await store(node.id, node.projectId, [item]))[0]!
    },

    async addFromClipboard(rawNodeId: unknown): Promise<ImageData> {
      const node = requireNode(rawNodeId)
      const bytes = (await host.readClipboard?.()) ?? null
      if (!bytes || bytes.length === 0)
        throw new DiagramError('CLIPBOARD_EMPTY', 'The clipboard holds no image')
      checkRoom(node.id, 1)
      const item = prepare('anh-dan.png', bytes, 'Ảnh dán')
      return (await store(node.id, node.projectId, [item]))[0]!
    },

    update(rawId: unknown, rawPatch: unknown): ImageData {
      const image = requireImage(rawId)
      const patch = plainObject(rawPatch, 'patch') as ImagePatch
      if (patch.caption !== undefined)
        images.setCaption(db, image.id, text(patch.caption, 'caption', 300))
      return images.toData(requireImage(image.id))
    },

    remove(rawId: unknown): null {
      const image = requireImage(rawId)
      // The file stays in anh/ so undo can bring the row back; sweep() moves it to thung-rac/ later.
      images.deleteImage(db, image.id)
      logger.info('image removed', { id: image.id })
      return null
    },

    reorder(rawNodeId: unknown, rawIds: unknown): null {
      const node = requireNode(rawNodeId)
      const ids = intList(rawIds, 'ids')
      const current = images.imageIdsOfNode(db, node.id)
      if (ids.length !== current.length || !ids.every((id) => current.includes(id)))
        throw new DiagramError('INVALID_ARGUMENT', 'ids must list every image of the block once')
      images.setImageOrder(db, ids)
      return null
    },

    /**
     * Moves files in anh/ that no row refers to into thung-rac/. They are what is left of deleted
     * blocks and images; until now they were kept so Ctrl+Z could restore them.
     */
    sweep(rawProjectId: unknown): { moved: number } {
      const projectId = intArg(rawProjectId, 'projectId')
      const record = projects.getProject(db, projectId)
      if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
      const dir = join(khoRoot, record.folder, 'anh')
      if (!existsSync(dir)) return { moved: 0 }
      const used = new Set<string>()
      for (const rel of images.referencedPaths(db, projectId)) {
        used.add(basename(rel))
        used.add(basename(thumbPath(rel)))
      }
      const orphans = readdirSync(dir).filter((name) => !used.has(name))
      if (orphans.length === 0) return { moved: 0 }
      const target = join(
        khoRoot,
        'thung-rac',
        `${basename(record.folder)}_anh_${trashStamp(now())}`
      )
      mkdirSync(target, { recursive: true })
      let moved = 0
      for (const name of orphans) {
        const from = join(dir, name)
        try {
          if (!statSync(from).isFile()) continue
          try {
            renameSync(from, join(target, name))
          } catch {
            copyFileSync(from, join(target, name))
            rmSync(from, { force: true })
          }
          moved++
        } catch {
          logger.warn('sweep failed for one file')
        }
      }
      logger.info('images swept', { moved })
      return { moved }
    }
  }
}

export type ImageService = ReturnType<typeof createImageService>
