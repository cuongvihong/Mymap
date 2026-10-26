import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { DiagramError } from '../src/main/diagram/errors'
import { parseImageUrl, resolveImageRequest } from '../src/main/diagram/imageProtocol'
import { createHistoryService } from '../src/main/diagram/services/history'
import { createImageService, type ImageHost } from '../src/main/diagram/services/image'
import { createNodeService } from '../src/main/diagram/services/node'
import { createPinService } from '../src/main/diagram/services/pin'
import { createProjectService } from '../src/main/diagram/services/project'
import { imageDimensions } from '../src/shared/diagram/imagesize'
import { snapshotNodes } from '../src/shared/diagram/snapshot'
import { makeKho, makeTempDir, removeDir, silentLogger } from './helpers/kho'

/** A PNG header with the wanted size. Only the header matters to the service. */
function png(width: number, height: number, padTo = 0): Buffer {
  const head = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0)
  head.writeUInt32BE(13, 8)
  head.write('IHDR', 12, 'ascii')
  head.writeUInt32BE(width, 16)
  head.writeUInt32BE(height, 20)
  return padTo > head.length ? Buffer.concat([head, Buffer.alloc(padTo - head.length)]) : head
}

let kho: ReturnType<typeof makeKho>
let outside: string
let ctx: DiagramContext
let projectId: number
let folder: string
let nodeId: number
let thumbCalls = 0

const host: ImageHost = {
  thumbnail: () => {
    thumbCalls++
    return Buffer.from('thumb')
  },
  readClipboard: () => null
}

const codeOf = async (fn: () => unknown): Promise<string> => {
  try {
    await fn()
  } catch (e) {
    if (e instanceof DiagramError) return e.code
    throw e
  }
  return 'NO_ERROR'
}

const file = (name: string, bytes: Buffer): string => {
  const path = join(outside, name)
  writeFileSync(path, bytes)
  return path
}

const service = (h: ImageHost = host) => createImageService(ctx, { host: h })
const anh = () => join(kho.root, folder, 'anh')

beforeEach(() => {
  kho = makeKho()
  outside = makeTempDir('mapapp-img-')
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  const project = createProjectService(ctx).create('Ảnh')
  projectId = project.id
  folder = project.folder
  nodeId = createNodeService(ctx).create(projectId, { type: 'fnc', title: 'Khối có ảnh' }).id
  thumbCalls = 0
})
afterEach(() => {
  kho.cleanup()
  removeDir(outside)
})

describe('image.addFromPaths', () => {
  it('copies the file into anh/, reads its size and makes a thumbnail', async () => {
    const [img] = await service().addFromPaths(nodeId, [file('fs09-swimlane.png', png(1288, 1930))])
    expect(img).toMatchObject({ nodeId, width: 1288, height: 1930, caption: 'fs09-swimlane' })
    expect(img!.relPath).toMatch(/^anh\/[0-9a-f-]{36}\.png$/)
    expect(existsSync(join(kho.root, folder, img!.relPath))).toBe(true)
    expect(existsSync(join(kho.root, folder, img!.relPath.replace('.png', '.thumb.png')))).toBe(
      true
    )
    expect(thumbCalls).toBe(1)
    const row = kho.db.prepare('SELECT COUNT(*) AS c FROM dg_images').get() as { c: number }
    expect(row.c).toBe(1)
  })

  it('works without a thumbnail encoder', async () => {
    const [img] = await service({}).addFromPaths(nodeId, [file('a.png', png(10, 10))])
    expect(existsSync(join(kho.root, folder, img!.relPath))).toBe(true)
    expect(readdirSync(anh())).toHaveLength(1)
  })

  it('rejects an image over 15 MB and adds nothing', async () => {
    const big = file('big.png', png(10, 10, 15 * 1024 * 1024 + 1))
    expect(await codeOf(() => service().addFromPaths(nodeId, [big]))).toBe('IMAGE_TOO_LARGE')
    expect(readdirSync(anh())).toHaveLength(0)
    const ok = file('exact.png', png(10, 10, 15 * 1024 * 1024))
    const [img] = await service().addFromPaths(nodeId, [ok])
    expect(img).toBeDefined()
  })

  it('rejects the 9th image of a block', async () => {
    const s = service()
    for (let i = 0; i < 8; i++) await s.addFromPaths(nodeId, [file(`p${i}.png`, png(20, 20))])
    expect(await codeOf(() => s.addFromPaths(nodeId, [file('p9.png', png(20, 20))]))).toBe(
      'IMAGE_LIMIT'
    )
    expect(kho.db.prepare('SELECT COUNT(*) AS c FROM dg_images').get()).toEqual({ c: 8 })
  })

  it('refuses a batch that would pass 8, without copying any file of it', async () => {
    const s = service()
    for (let i = 0; i < 6; i++) await s.addFromPaths(nodeId, [file(`p${i}.png`, png(20, 20))])
    const three = ['x', 'y', 'z'].map((n) => file(`${n}.png`, png(20, 20)))
    expect(await codeOf(() => s.addFromPaths(nodeId, three))).toBe('IMAGE_LIMIT')
    expect(readdirSync(anh())).toHaveLength(6 + 6) // 6 images and 6 thumbnails
  })

  it('refuses other formats and files that are not real images', async () => {
    const s = service()
    expect(await codeOf(() => s.addFromPaths(nodeId, [file('a.bmp', png(5, 5))]))).toBe(
      'IMAGE_FORMAT'
    )
    expect(
      await codeOf(() =>
        s.addFromPaths(nodeId, [file('b.png', Buffer.from('not an image at all'))])
      )
    ).toBe('IMAGE_UNREADABLE')
    expect(await codeOf(() => s.addFromPaths(nodeId, [join(outside, 'missing.png')]))).toBe(
      'IMAGE_UNREADABLE'
    )
    expect(await codeOf(() => s.addFromPaths(999, [file('c.png', png(5, 5))]))).toBe(
      'NODE_NOT_FOUND'
    )
  })

  it('adds dropped bytes and clipboard images, and reports an empty clipboard', async () => {
    const s = service()
    const dropped = await s.addFromBytes(nodeId, 'keo-tha.png', png(30, 40))
    expect(dropped).toMatchObject({ width: 30, height: 40, caption: 'keo-tha' })
    expect(await codeOf(() => s.addFromClipboard(nodeId))).toBe('CLIPBOARD_EMPTY')
    const pasted = await service({ readClipboard: () => png(50, 60) }).addFromClipboard(nodeId)
    expect(pasted).toMatchObject({ width: 50, height: 60, caption: 'Ảnh dán', sortOrder: 1 })
  })

  it('reorders, renames and removes while the file stays until sweep', async () => {
    const s = service()
    const a = (await s.addFromPaths(nodeId, [file('a.png', png(5, 5))]))[0]!
    const b = (await s.addFromPaths(nodeId, [file('b.png', png(5, 5))]))[0]!
    s.reorder(nodeId, [b.id, a.id])
    const order = kho.db.prepare('SELECT id FROM dg_images ORDER BY sort_order').all() as {
      id: number
    }[]
    expect(order.map((r) => r.id)).toEqual([b.id, a.id])
    expect(() => s.reorder(nodeId, [a.id])).toThrow(DiagramError)
    expect(s.update(a.id, { caption: 'Sơ đồ' }).caption).toBe('Sơ đồ')

    s.remove(a.id)
    expect(existsSync(join(kho.root, folder, a.relPath))).toBe(true)
    const swept = s.sweep(projectId)
    expect(swept.moved).toBe(2) // the image and its thumbnail
    expect(existsSync(join(kho.root, folder, a.relPath))).toBe(false)
    expect(existsSync(join(kho.root, folder, b.relPath))).toBe(true)
    const trash = readdirSync(join(kho.root, 'thung-rac'))
    expect(trash).toHaveLength(1)
    expect(readdirSync(join(kho.root, 'thung-rac', trash[0]!))).toHaveLength(2)
    expect(s.sweep(projectId).moved).toBe(0)
  })
})

describe('deleting a block with images', () => {
  it('keeps the files so undo brings images and pins back, and sweep afterwards moves nothing', async () => {
    const s = service()
    const img = (await s.addFromPaths(nodeId, [file('a.png', png(100, 200))]))[0]!
    const pins = createPinService(ctx)
    pins.create(img.id, { xPct: 10, yPct: 20, note: 'Một' })
    pins.create(img.id, { xPct: 30, yPct: 40, note: 'Hai' })

    const data = createProjectService(ctx).load(projectId)
    const bundle = snapshotNodes(data, [nodeId])
    expect(bundle.images).toHaveLength(1)
    expect(bundle.pins).toHaveLength(2)

    createNodeService(ctx).remove([nodeId])
    expect(kho.db.prepare('SELECT COUNT(*) AS c FROM dg_images').get()).toEqual({ c: 0 })
    expect(kho.db.prepare('SELECT COUNT(*) AS c FROM dg_pins').get()).toEqual({ c: 0 })
    expect(existsSync(join(kho.root, folder, img.relPath))).toBe(true)

    createHistoryService(ctx).restore(projectId, bundle)
    const back = createProjectService(ctx).load(projectId)
    expect(back.images).toHaveLength(1)
    expect(back.images[0]!.id).toBe(img.id)
    expect(back.pins.map((p) => p.note)).toEqual(['Một', 'Hai'])
    expect(s.sweep(projectId).moved).toBe(0)
  })

  it('moves the files of a block that stays deleted into thung-rac/ when the project is swept', async () => {
    const s = service()
    const img = (await s.addFromPaths(nodeId, [file('a.png', png(100, 200))]))[0]!
    createNodeService(ctx).remove([nodeId])
    expect(s.sweep(projectId).moved).toBe(2)
    expect(existsSync(join(kho.root, folder, img.relPath))).toBe(false)
  })
})

describe('pins', () => {
  let imageId: number
  beforeEach(async () => {
    imageId = (await service().addFromPaths(nodeId, [file('a.png', png(100, 200))]))[0]!.id
  })

  it('creates, moves, renames, reorders and removes', () => {
    const pins = createPinService(ctx)
    const a = pins.create(imageId, { xPct: 16.74, yPct: 40.5, note: 'Parent chọn EA' })
    const b = pins.create(imageId, { xPct: 50, yPct: 50 })
    expect(a).toMatchObject({ xPct: 16.7, yPct: 40.5, sortOrder: 0 })
    expect(b).toMatchObject({ note: '', sortOrder: 1 })
    expect(pins.update(b.id, { xPct: 60, note: 'Ghim hai' })).toMatchObject({
      xPct: 60,
      yPct: 50,
      note: 'Ghim hai'
    })
    pins.reorder(imageId, [b.id, a.id])
    const rows = kho.db.prepare('SELECT id FROM dg_pins ORDER BY sort_order').all() as {
      id: number
    }[]
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id])
    pins.remove(a.id)
    expect(() => pins.remove(a.id)).toThrow(DiagramError)
  })

  it('limits the note to 120 characters and the position to 0..100', async () => {
    const pins = createPinService(ctx)
    expect(
      await codeOf(() => pins.create(imageId, { xPct: 1, yPct: 1, note: 'a'.repeat(121) }))
    ).toBe('FIELD_TOO_LONG')
    expect(pins.create(imageId, { xPct: 1, yPct: 1, note: 'a'.repeat(120) }).note).toHaveLength(120)
    expect(await codeOf(() => pins.create(imageId, { xPct: 101, yPct: 1 }))).toBe(
      'INVALID_ARGUMENT'
    )
    expect(await codeOf(() => pins.create(imageId, { xPct: -1, yPct: 1 }))).toBe('INVALID_ARGUMENT')
    expect(await codeOf(() => pins.create(999, { xPct: 1, yPct: 1 }))).toBe('IMAGE_NOT_FOUND')
  })

  it('deletes the pins together with the image', () => {
    createPinService(ctx).create(imageId, { xPct: 1, yPct: 1 })
    service().remove(imageId)
    expect(kho.db.prepare('SELECT COUNT(*) AS c FROM dg_pins').get()).toEqual({ c: 0 })
  })
})

describe('mapimg protocol', () => {
  it('parses the shape and refuses path tricks', () => {
    expect(parseImageUrl('mapimg://1/anh/a.png')).toEqual({ projectId: 1, rel: 'anh/a.png' })
    expect(parseImageUrl('mapimg://1/anh/a%20b.png')).toEqual({ projectId: 1, rel: 'anh/a b.png' })
    // Chromium hands a numeric host over as an IPv4 address.
    expect(parseImageUrl('mapimg://0.0.0.7/anh/a.png')).toEqual({ projectId: 7, rel: 'anh/a.png' })
    expect(parseImageUrl('mapimg://0.0.1.0/anh/a.png')?.projectId).toBe(256)
    expect(parseImageUrl('mapimg://0.0.0.999/anh/a.png')).toBeNull()
    expect(parseImageUrl('mapimg://1/../../data/mapapp.db')).toBeNull()
    expect(parseImageUrl('mapimg://1/anh/%2e%2e/%2e%2e/data/mapapp.db')).toBeNull()
    expect(parseImageUrl('mapimg://1/anh\\..\\x.png')).toBeNull()
    expect(parseImageUrl('mapimg://x/anh/a.png')).toBeNull()
    expect(parseImageUrl('mapimg://1//anh/a.png')).toBeNull()
    expect(parseImageUrl('http://1/anh/a.png')).toBeNull()
    expect(parseImageUrl('mapimg://1')).toBeNull()
  })

  it('serves only image files inside the project anh/ folder', async () => {
    const img = (await service().addFromPaths(nodeId, [file('a.png', png(10, 10))]))[0]!
    const url = `mapimg://${projectId}/${img.relPath}`
    expect(resolveImageRequest(ctx, url)).toBe(join(kho.root, folder, img.relPath))
    expect(resolveImageRequest(ctx, 'mapimg://1/../../data/mapapp.db')).toBeNull()
    expect(resolveImageRequest(ctx, `mapimg://${projectId}/data/mapapp.db`)).toBeNull()
    expect(resolveImageRequest(ctx, `mapimg://${projectId}/anh/x.db`)).toBeNull()
    expect(resolveImageRequest(ctx, `mapimg://${projectId + 1}/${img.relPath}`)).toBeNull()
    mkdirSync(join(kho.root, 'data'), { recursive: true })
    writeFileSync(join(kho.root, 'data', 'x.png'), png(1, 1))
    expect(resolveImageRequest(ctx, `mapimg://${projectId}/anh/..%2f..%2fdata%2fx.png`)).toBeNull()
  })

  it('falls back to the original when a thumbnail does not exist', async () => {
    const img = (await service({}).addFromPaths(nodeId, [file('a.png', png(10, 10))]))[0]!
    const thumbUrl = `mapimg://${projectId}/${img.relPath.replace('.png', '.thumb.png')}`
    expect(resolveImageRequest(ctx, thumbUrl)).toBe(join(kho.root, folder, img.relPath))
  })
})

describe('image size from the header', () => {
  it('reads PNG, GIF, JPEG and WEBP', () => {
    expect(imageDimensions(png(321, 123))).toEqual({ width: 321, height: 123 })
    const gif = Buffer.alloc(16)
    gif.write('GIF89a', 0, 'ascii')
    gif.writeUInt16LE(40, 6)
    gif.writeUInt16LE(30, 8)
    expect(imageDimensions(gif)).toEqual({ width: 40, height: 30 })
    const jpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x01, 0x2c,
      0x02, 0x58, 0x01, 0x01, 0x11, 0x00
    ])
    expect(imageDimensions(jpg)).toEqual({ width: 600, height: 300 })
    const webp = Buffer.alloc(40)
    webp.write('RIFF', 0, 'ascii')
    webp.write('WEBP', 8, 'ascii')
    webp.write('VP8X', 12, 'ascii')
    webp.writeUIntLE(799, 24, 3)
    webp.writeUIntLE(599, 27, 3)
    expect(imageDimensions(webp)).toEqual({ width: 800, height: 600 })
    expect(imageDimensions(Buffer.from('hello world, not an image'))).toBeNull()
  })
})
