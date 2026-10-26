import { appendFileSync } from 'node:fs'
import ELK from 'elkjs/lib/elk.bundled.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { createImageService, type ImageHost } from '../src/main/diagram/services/image'
import { createNodeService } from '../src/main/diagram/services/node'
import { createProjectService } from '../src/main/diagram/services/project'
import { createYamlService } from '../src/main/diagram/services/yaml'
import type { ElkLike } from '../src/shared/diagram/autolayout'
import type { Rect } from '../src/shared/diagram/geometry'
import { planLayout } from '../src/shared/diagram/layoutPlan'
import { fakePng, generate } from '../scripts/gen-big-project.mjs'
import { makeKho, silentLogger } from './helpers/kho'

/**
 * NFR-03 (open a project of 200 blocks in under 2 s) and NFR-04 (import, check and layout 200
 * blocks in under 3 s), measured on the service layer. The limits are the ones of the FSD, the
 * real numbers are far below them. Set PERF_REPORT=<file> to append the measured times.
 */
const elk = new ELK() as unknown as ElkLike
let kho: ReturnType<typeof makeKho>
let ctx: DiagramContext

const record = (name: string, ms: number) => {
  const file = process.env['PERF_REPORT']
  if (file) appendFileSync(file, `${name}\t${ms.toFixed(0)}\n`)
}
const time = async <T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<{ value: T; ms: number }> => {
  const t0 = performance.now()
  const value = await fn()
  const ms = performance.now() - t0
  record(name, ms)
  return { value, ms }
}

const host: ImageHost = { thumbnail: () => Buffer.from('thumb'), readClipboard: () => null }

beforeEach(() => {
  kho = makeKho()
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
})
afterEach(() => kho.cleanup())

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('generator', () => {
  it('writes 200 blocks, 400 channels, 8 groups and 30 scenarios that pass the checks', () => {
    const { yaml, nodes, links, groups, scenarios } = generate({ seed: 3 })
    expect([nodes.length, links.length, groups.length, scenarios.length]).toEqual([200, 400, 8, 30])
    const preview = createYamlService(ctx).previewNew(yaml)
    expect(preview.ok, JSON.stringify(preview.issues.slice(0, 3))).toBe(true)
    if (preview.ok)
      expect(preview.summary.add).toEqual({ groups: 8, nodes: 200, links: 400, scenarios: 30 })
  })

  it('gives the same file for the same seed and another for a new seed', () => {
    expect(generate({ seed: 5 }).yaml).toBe(generate({ seed: 5 }).yaml)
    expect(generate({ seed: 5 }).yaml).not.toBe(generate({ seed: 6 }).yaml)
  })

  it('writes a PNG that has the asked size', () => {
    const png = fakePng(64, 40, 1)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([64, 40])
  })
})

describe('NFR-03 and NFR-04 with 200 blocks', () => {
  it('opens a project with 200 blocks, 400 channels and 40 blocks with an image in under 2 s', async () => {
    const { yaml, nodes } = generate({ seed: 11, layout: true })
    const { project } = createYamlService(ctx).applyNew('Lớn', yaml)
    const data0 = createProjectService(ctx).load(project.id)
    const images = createImageService(ctx, { host })
    for (let i = 0; i < 40; i++) {
      const node = data0.nodes.find((n) => n.key === nodes[i * 5]!.id)!
      await images.addFromBytes(node.id, `a${i}.png`, fakePng(320, 200, i + 1))
    }
    const { value: data, ms } = await time('open project (load)', () =>
      createProjectService(ctx).load(project.id)
    )
    expect(data.nodes).toHaveLength(200)
    expect(data.links).toHaveLength(400)
    expect(data.images).toHaveLength(40)
    expect(ms).toBeLessThan(2000)
  })

  it('imports, checks and lays out 200 blocks without coordinates in under 3 s, nothing overlapping', async () => {
    const { yaml } = generate({ seed: 12 })
    const t0 = performance.now()
    const yamlService = createYamlService(ctx)
    const preview = yamlService.previewNew(yaml)
    expect(preview.ok).toBe(true)
    record('  check (previewNew)', performance.now() - t0)
    const t1 = performance.now()
    const { project } = yamlService.applyNew('Lớn không tọa độ', yaml)
    record('  write (applyNew, with its own check)', performance.now() - t1)
    const loaded = createProjectService(ctx).load(project.id)
    const t2 = performance.now()
    expect(loaded.nodes.every((n) => !n.hasLayout)).toBe(true)
    const moves = await planLayout(elk, loaded, { kind: 'pending' })
    record('  layout (ELK in Node)', performance.now() - t2)
    createNodeService(ctx).move(moves.map(({ id, x, y }) => ({ id, x, y })))
    const total = performance.now() - t0
    record('import + check + layout (service)', total)
    expect(total).toBeLessThan(3000)
    const after = createProjectService(ctx).load(project.id)
    expect(after.nodes.every((n) => n.hasLayout)).toBe(true)
    const rects: Rect[] = after.nodes.map((n) => ({ x: n.x, y: n.y, w: 250, h: 130 }))
    let bad = 0
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) if (overlaps(rects[i]!, rects[j]!)) bad++
    expect(bad).toBe(0)
  })

  it('imports the same 200 blocks again as 0 added, 0 updated, 0 removed, and fast', async () => {
    const { yaml } = generate({ seed: 13, layout: true })
    const yamlService = createYamlService(ctx)
    const { project } = yamlService.applyNew('Lớn lặp', yaml)
    const { value: preview, ms } = await time('re-import preview (200 blocks)', () =>
      yamlService.preview(project.id, yaml, { removeMissing: false })
    )
    expect(preview.ok).toBe(true)
    if (preview.ok) expect(preview.summary.unchanged).toBe(true)
    expect(ms).toBeLessThan(3000)
  })
})
