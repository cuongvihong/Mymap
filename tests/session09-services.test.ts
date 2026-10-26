import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ELK from 'elkjs/lib/elk.bundled.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { DiagramError } from '../src/main/diagram/errors'
import { createExportService } from '../src/main/diagram/services/export'
import { createNodeService } from '../src/main/diagram/services/node'
import { createProjectService } from '../src/main/diagram/services/project'
import { createYamlService, IMPORT_MAX_BYTES } from '../src/main/diagram/services/yaml'
import type { ElkLike } from '../src/shared/diagram/autolayout'
import { frameBounds } from '../src/shared/diagram/frames'
import type { Rect } from '../src/shared/diagram/geometry'
import { serializeFlowmap } from '../src/shared/diagram/flowmap'
import { estimatedSize, planLayout } from '../src/shared/diagram/layoutPlan'
import type { ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'
import { sampleDoc, sampleText } from './helpers/sample'

let kho: ReturnType<typeof makeKho>
let ctx: DiagramContext
const elk = new ELK() as unknown as ElkLike
const opened: string[] = []

const noLayoutText = () => serializeFlowmap({ ...sampleDoc(), layout: {} })
const KEEP = { removeMissing: false }

function exporter() {
  return createExportService(ctx, {
    openPath: async (p) => {
      opened.push(p)
      return ''
    }
  })
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Applies the layout of the "pending" scope the way the renderer does after an import. */
async function layoutPending(projectId: number): Promise<ProjectData> {
  const data = createProjectService(ctx).load(projectId)
  const moves = await planLayout(elk, data, { kind: 'pending' })
  createNodeService(ctx).move(moves.map(({ id, x, y }) => ({ id, x, y })))
  return createProjectService(ctx).load(projectId)
}

beforeEach(() => {
  kho = makeKho()
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  opened.length = 0
})
afterEach(() => kho.cleanup())

describe('import into a new project', () => {
  it('previews against an empty project and creates nothing', () => {
    const yaml = createYamlService(ctx)
    const preview = yaml.previewNew(sampleText())
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.summary.add).toEqual({ groups: 4, nodes: 31, links: 37, scenarios: 9 })
    expect(createProjectService(ctx).list()).toHaveLength(0)
  })

  it('creates the project with 31 blocks, 37 channels and 9 scenarios, as image 01', () => {
    const { project, summary } = createYamlService(ctx).applyNew(
      'MOE Education Account',
      sampleText()
    )
    expect(summary.add.nodes).toBe(31)
    expect(project.name).toBe('MOE Education Account')
    const data = createProjectService(ctx).load(project.id)
    expect(data.nodes).toHaveLength(31)
    expect(data.links).toHaveLength(37)
    expect(data.scenarios).toHaveLength(9)
    expect(data.groups).toHaveLength(4)
  })

  it('imports the same file a second time as 0 added, 0 updated, 0 removed', () => {
    const yaml = createYamlService(ctx)
    const { project } = yaml.applyNew('MOE', sampleText())
    const again = yaml.preview(project.id, sampleText(), KEEP)
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.summary.unchanged).toBe(true)
  })

  it('does not create a project for a text with errors', () => {
    const yaml = createYamlService(ctx)
    const bad = sampleText().replace('to: LDG', 'to: LDX')
    expect(bad).not.toBe(sampleText())
    expect(yaml.previewNew(bad).ok).toBe(false)
    expect(() => yaml.applyNew('Lỗi', bad)).toThrow(DiagramError)
    expect(createProjectService(ctx).list()).toHaveLength(0)
  })

  it('refuses a name that another project already has, and leaves the list as it was', () => {
    const yaml = createYamlService(ctx)
    yaml.applyNew('MOE', sampleText())
    expect(() => yaml.applyNew('moe', sampleText())).toThrow(DiagramError)
    expect(createProjectService(ctx).list()).toHaveLength(1)
  })

  it('reads a Mermaid file into a new project, with warnings kept for the dialog', () => {
    const yaml = createYamlService(ctx)
    const text = [
      'flowchart LR',
      'A([Bắt đầu]) --> B[Làm việc]',
      'style A fill:#f00',
      'B --> C([Xong])'
    ].join('\n')
    const preview = yaml.previewNew(text)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.summary.add).toMatchObject({ nodes: 3, links: 2 })
    expect(preview.issues.map((i) => [i.line, i.severity])).toEqual([[3, 'warning']])
    const { project } = yaml.applyNew('Từ Mermaid', text)
    expect(createProjectService(ctx).load(project.id).nodes).toHaveLength(3)
  })

  it('rejects a Mermaid file that has no blocks', () => {
    const preview = createYamlService(ctx).previewNew('flowchart LR\n%% nothing')
    expect(preview.ok).toBe(false)
  })
})

describe('layout after an import without the layout section (NFR-04)', () => {
  it('gives every block coordinates with no overlap between blocks or group frames', async () => {
    const yaml = createYamlService(ctx)
    const { project } = yaml.applyNew('MOE', noLayoutText())
    const before = createProjectService(ctx).load(project.id)
    expect(before.nodes.every((n) => !n.hasLayout)).toBe(true)

    const t0 = Date.now()
    const data = await layoutPending(project.id)
    const ms = Date.now() - t0
    expect(ms).toBeLessThan(3000)
    expect(data.nodes.every((n) => n.hasLayout)).toBe(true)

    const rects = data.nodes.map((n) => ({ n, r: { x: n.x, y: n.y, ...sizeOf(n) } }))
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(overlaps(rects[i]!.r, rects[j]!.r)).toBe(false)
    const frames = data.groups.map((g) =>
      frameBounds(rects.filter((x) => x.n.groupId === g.id).map((x) => x.r))
    )
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++)
        expect(overlaps(frames[i] as Rect, frames[j] as Rect)).toBe(false)
  })

  it('puts new blocks of a second import under the blocks that are already placed', async () => {
    const yaml = createYamlService(ctx)
    const { project } = yaml.applyNew('MOE', sampleText())
    const placed = createProjectService(ctx).load(project.id)
    const bottom = Math.max(...placed.nodes.map((n) => n.y + estimatedSize(n).h))
    const more = serializeFlowmap({
      ...sampleDoc(),
      layout: {},
      nodes: [
        ...sampleDoc().nodes,
        { ...sampleDoc().nodes[0]!, id: 'NEW1', code: 'NEW1', title: 'Khối mới 1' },
        { ...sampleDoc().nodes[0]!, id: 'NEW2', code: 'NEW2', title: 'Khối mới 2' }
      ]
    })
    yaml.apply(project.id, more, KEEP)
    const data = await layoutPending(project.id)
    const fresh = data.nodes.filter((n) => n.key.startsWith('NEW'))
    expect(fresh).toHaveLength(2)
    for (const n of fresh) expect(n.y).toBeGreaterThanOrEqual(bottom)
    // the blocks that were placed did not move (BR-04)
    for (const n of placed.nodes) {
      const after = data.nodes.find((x) => x.id === n.id)!
      expect([after.x, after.y]).toEqual([n.x, n.y])
    }
  })

  it('a selection is laid out in place and the others stay', async () => {
    const yaml = createYamlService(ctx)
    const { project } = yaml.applyNew('MOE', sampleText())
    const data = createProjectService(ctx).load(project.id)
    const chosen = data.nodes.filter((n) => n.groupId === data.groups[0]!.id).map((n) => n.id)
    const moves = await planLayout(elk, data, { kind: 'selection', ids: chosen })
    expect(moves.map((m) => m.id).sort()).toEqual([...chosen].sort())
    const minX = Math.min(...data.nodes.filter((n) => chosen.includes(n.id)).map((n) => n.x))
    expect(Math.min(...moves.map((m) => m.x))).toBe(minX)
  })
})

function sizeOf(n: ProjectData['nodes'][number]) {
  const s = estimatedSize(n)
  return { w: s.w, h: s.h }
}

describe('export', () => {
  async function project() {
    const yaml = createYamlService(ctx)
    return yaml.applyNew('MOE Education Account', sampleText()).project
  }

  it('writes Mermaid to xuat/', async () => {
    const p = await project()
    const { file } = exporter().mermaid(p.id)
    expect(file).toBe('xuat/moe-education-account.mmd')
    const text = readFileSync(join(kho.root, file), 'utf8')
    expect(text.startsWith('flowchart LR')).toBe(true)
    expect(text).toContain('subgraph')
  })

  it('writes JSON Canvas with coordinates for every block, even when none were placed', async () => {
    const yaml = createYamlService(ctx)
    const p = yaml.applyNew('Không tọa độ', noLayoutText()).project
    const { file } = await exporter().jsonCanvas(p.id)
    expect(file).toBe('xuat/khong-toa-do.canvas')
    const canvas = JSON.parse(readFileSync(join(kho.root, file), 'utf8')) as {
      nodes: { type: string; x: number; y: number; width: number; height: number }[]
      edges: unknown[]
    }
    expect(canvas.nodes.filter((n) => n.type === 'text')).toHaveLength(31)
    expect(canvas.nodes.filter((n) => n.type === 'group')).toHaveLength(4)
    expect(canvas.edges).toHaveLength(37)
    const texts = canvas.nodes.filter((n) => n.type === 'text')
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i]!
        const b = texts[j]!
        expect(
          overlaps(
            { x: a.x, y: a.y, w: a.width, h: a.height },
            { x: b.x, y: b.y, w: b.width, h: b.height }
          )
        ).toBe(false)
      }
  })

  it('saves a PNG and refuses anything else', async () => {
    const p = await project()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==',
      'base64'
    )
    const { file } = exporter().png(p.id, `data:image/png;base64,${png.toString('base64')}`)
    expect(file).toBe('xuat/moe-education-account.png')
    expect(readFileSync(join(kho.root, file)).subarray(0, 4).toString('hex')).toBe('89504e47')
    const bad = (value: unknown) => {
      try {
        exporter().png(p.id, value)
      } catch (e) {
        return e instanceof DiagramError ? e.code : 'OTHER'
      }
      return 'OK'
    }
    expect(bad('data:image/jpeg;base64,AAAA')).toBe('EXPORT_IMAGE_INVALID')
    expect(bad(`data:image/png;base64,${Buffer.from('not a png').toString('base64')}`)).toBe(
      'EXPORT_IMAGE_INVALID'
    )
    expect(bad(42)).toBe('EXPORT_IMAGE_INVALID')
  })

  it('opens the xuat folder of the Kho', async () => {
    await exporter().openFolder()
    expect(opened).toEqual([join(kho.root, 'xuat')])
    expect(existsSync(join(kho.root, 'xuat'))).toBe(true)
  })
})

describe('reading the file chosen for import', () => {
  it('reads a text file and drops the BOM', () => {
    const dir = join(kho.root, 'tmp')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.flowmap.yaml'), `\uFEFF${sampleText()}`)
    const file = createYamlService(ctx).readFile(join(dir, 'a.flowmap.yaml'))
    expect(file.name).toBe('a.flowmap.yaml')
    expect(file.text.charCodeAt(0)).not.toBe(0xfeff)
    expect(file.text).toContain('flowmap:')
  })

  it('refuses a missing file and a file over the limit', () => {
    const yaml = createYamlService(ctx)
    expect(() => yaml.readFile(join(kho.root, 'nope.yaml'))).toThrow(DiagramError)
    const big = join(kho.root, 'big.yaml')
    writeFileSync(big, Buffer.alloc(IMPORT_MAX_BYTES + 1, 97))
    expect(() => yaml.readFile(big)).toThrow(/too large/)
  })
})
