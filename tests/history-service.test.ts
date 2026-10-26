import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { findSampleFile, seedSampleProject } from '../src/main/diagram/seed'
import { createGroupService } from '../src/main/diagram/services/group'
import { createHistoryService } from '../src/main/diagram/services/history'
import { createNodeService } from '../src/main/diagram/services/node'
import { createProjectService } from '../src/main/diagram/services/project'
import { planClone } from '../src/shared/diagram/clone'
import { snapshotNodes } from '../src/shared/diagram/snapshot'
import type { ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'

let kho: ReturnType<typeof makeKho>
let ctx: DiagramContext
let projectId: number

const load = (): ProjectData => createProjectService(ctx).load(projectId)

/** Step ids are not part of the contract, everything else must come back. */
const shape = (d: ProjectData) => ({
  groups: d.groups,
  nodes: d.nodes,
  links: d.links,
  scenarios: d.scenarios,
  steps: d.steps.map(({ id: _id, ...s }) => (void _id, s))
})

beforeEach(() => {
  kho = makeKho()
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  const file = findSampleFile(process.cwd())
  expect(file).not.toBeNull()
  projectId = seedSampleProject(ctx, file as string) as number
})
afterEach(() => kho.cleanup())

describe('history.restore', () => {
  it('undoes a block delete: blocks, channels, steps and forks come back exactly', () => {
    const before = load()
    const f9d = before.nodes.find((n) => n.key === 'F9D')!
    const bundle = snapshotNodes(before, [f9d.id])
    expect(bundle.links!.length).toBeGreaterThan(3)
    expect(bundle.forks!.length).toBeGreaterThan(0)

    createNodeService(ctx).remove([f9d.id])
    const gone = load()
    expect(gone.nodes.find((n) => n.key === 'F9D')).toBeUndefined()
    expect(gone.links.length).toBeLessThan(before.links.length)
    expect(gone.scenarios.some((s) => s.parentId === null && s.key === 'N-05')).toBe(true)

    const result = createHistoryService(ctx).restore(projectId, bundle)
    expect(result.nodes.map((n) => n.id)).toEqual([f9d.id])
    expect(shape(load())).toEqual(shape(before))
  })

  it('undoes a group delete that also removed its blocks', () => {
    const before = load()
    const group = before.groups[3]!
    const members = before.nodes.filter((n) => n.groupId === group.id).map((n) => n.id)
    expect(members.length).toBeGreaterThan(0)
    const bundle = snapshotNodes(before, members, [group])
    createGroupService(ctx).remove(group.id, false)
    expect(load().groups.find((g) => g.id === group.id)).toBeUndefined()
    createHistoryService(ctx).restore(projectId, bundle)
    expect(shape(load())).toEqual(shape(before))
  })

  it('inserts copies without ids, keeping inner channels (paste)', () => {
    const before = load()
    const ids = ['F9B', 'F9C', 'F9D'].map((k) => before.nodes.find((n) => n.key === k)!.id)
    const plan = planClone({
      nodes: before.nodes,
      links: before.links,
      ids,
      takenNodeKeys: before.nodes.map((n) => n.key),
      takenLinkKeys: before.links.map((l) => l.key),
      offset: { x: 40, y: 40 }
    })
    const result = createHistoryService(ctx).restore(projectId, {
      nodes: plan.nodes.map((n) => ({ key: n.key, code: n.code, ...n.data })),
      links: plan.links
    })
    expect(result.nodes).toHaveLength(3)
    expect(result.nodes.map((n) => n.key)).toEqual(['F9B-copy', 'F9C-copy', 'F9D-copy'])
    expect(result.links.length).toBe(plan.links.length)
    const after = load()
    expect(after.nodes).toHaveLength(before.nodes.length + 3)
    const copy = after.nodes.find((n) => n.key === 'F9C-copy')!
    expect(copy.x).toBe(before.nodes.find((n) => n.key === 'F9C')!.x + 40)
    expect(copy.groupId).toBe(before.nodes.find((n) => n.key === 'F9C')!.groupId)
  })

  it('refuses a duplicate key and rolls everything back', () => {
    const before = load()
    const n = before.nodes[0]!
    expect(() =>
      createHistoryService(ctx).restore(projectId, {
        nodes: [
          { ...n, id: undefined, key: 'ZZ1' },
          { ...n, id: undefined, key: n.key }
        ]
      })
    ).toThrow(/taken/)
    expect(load().nodes).toHaveLength(before.nodes.length)
  })
})

describe('empty group frame (FR-VC-05)', () => {
  it('stores and returns the 400 x 260 frame, and clears it with null', () => {
    const svc = createGroupService(ctx)
    const g = svc.create(projectId, {
      title: 'Nhóm trống',
      frame: { x: 10, y: 20, w: 400, h: 260 }
    })
    expect(g.frame).toEqual({ x: 10, y: 20, w: 400, h: 260 })
    expect(load().groups.find((x) => x.id === g.id)?.frame).toEqual(g.frame)
    expect(svc.update(g.id, { frame: null }).frame).toBeNull()
    expect(() => svc.create(projectId, { title: 'x', frame: { x: 0, y: 0, w: 0, h: 5 } })).toThrow()
  })
})
