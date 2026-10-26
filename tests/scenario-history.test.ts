import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { findSampleFile, seedSampleProject } from '../src/main/diagram/seed'
import { createHistoryService } from '../src/main/diagram/services/history'
import { createProjectService } from '../src/main/diagram/services/project'
import { createScenarioService } from '../src/main/diagram/services/scenario'
import { dataScenarios } from '../src/shared/diagram/flowmap/convert'
import { addStep, branchDraft, newDraft, validateDraft } from '../src/shared/diagram/recorder'
import { fullPath } from '../src/shared/diagram/scenario'
import { bundleScenario, bundleSteps, snapshotScenarioDelete } from '../src/shared/diagram/snapshot'
import type { ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'

let kho: ReturnType<typeof makeKho>
let ctx: DiagramContext
let projectId: number

const load = (): ProjectData => createProjectService(ctx).load(projectId)
const scenarios = () => createScenarioService(ctx)
const history = () => createHistoryService(ctx)
const byKey = (data: ProjectData, key: string) => data.scenarios.find((s) => s.key === key)!
const shape = (d: ProjectData) => ({
  scenarios: d.scenarios,
  steps: d.steps.map(({ id: _id, ...s }) => (void _id, s))
})

beforeEach(() => {
  kho = makeKho()
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  const file = findSampleFile(process.cwd())
  if (!file) throw new Error('sample not found')
  projectId = seedSampleProject(ctx, file) as number
})
afterEach(() => kho.cleanup())

describe('undo of scenario delete (FR-KB-07, FR-SUA-05)', () => {
  it('cascade: the scenario and every branch below come back under their old ids', () => {
    const before = load()
    const a01 = byKey(before, 'A-01')
    const bundle = snapshotScenarioDelete(before, a01.id, 'cascade')
    expect(bundle.scenarios?.map((s) => s.key)).toEqual(['A-01', 'N-05', 'E-02'])

    scenarios().remove(a01.id, 'cascade')
    expect(load().scenarios).toHaveLength(6)
    history().restore(projectId, bundle)
    expect(shape(load())).toEqual(shape(before))
  })

  it('promote: the branch goes back below the deleted scenario with its own steps', () => {
    const before = load()
    const a01 = byKey(before, 'A-01')
    const bundle = snapshotScenarioDelete(before, a01.id, 'promote')
    scenarios().remove(a01.id, 'promote')
    const mid = load()
    expect(byKey(mid, 'N-05').parentId).toBe(byKey(mid, 'P-01').id)
    history().restore(projectId, bundle)
    const after = load()
    expect(shape(after)).toEqual(shape(before))
    expect(byKey(after, 'N-05').parentId).toBe(a01.id)
  })

  it('deleting a root with branches, promote then undo, restores the whole tree', () => {
    const before = load()
    const p01 = byKey(before, 'P-01')
    const bundle = snapshotScenarioDelete(before, p01.id, 'promote')
    scenarios().remove(p01.id, 'promote')
    expect(load().scenarios.every((s) => s.key !== 'P-01')).toBe(true)
    history().restore(projectId, bundle)
    expect(shape(load())).toEqual(shape(before))
  })

  it('restoring a scenario whose key was taken meanwhile is refused and changes nothing', () => {
    const before = load()
    const n04 = byKey(before, 'N-04')
    const bundle = snapshotScenarioDelete(before, n04.id, 'cascade')
    scenarios().remove(n04.id, 'cascade')
    scenarios().create(projectId, {
      key: 'N-04',
      type: 'neg',
      title: 'Taken',
      steps: [{ nodeId: before.nodes[0]!.id }]
    })
    expect(() => history().restore(projectId, bundle)).toThrow()
    expect(load().scenarios.filter((s) => s.key === 'N-04')).toHaveLength(1)
  })

  it('undo of a recording removes it, redo puts it back under the same id', () => {
    const data = load()
    const nodes = data.nodes.slice(0, 3)
    const created = scenarios().create(projectId, {
      type: 'pos',
      title: 'Mới',
      steps: nodes.map((n) => ({ nodeId: n.id, note: n.key }))
    })
    const redo = {
      scenarios: [bundleScenario(created.scenario, data.nodes)],
      steps: [bundleSteps(created.scenario.id, created.steps, data.nodes)]
    }
    scenarios().remove(created.scenario.id, 'cascade')
    expect(load().scenarios).toHaveLength(9)
    history().restore(projectId, redo)
    const after = load()
    expect(after.scenarios.find((s) => s.id === created.scenario.id)?.title).toBe('Mới')
    expect(
      after.steps.filter((s) => s.scenarioId === created.scenario.id).map((s) => s.note)
    ).toEqual(nodes.map((n) => n.key))
  })
})

describe('recording a scenario and branching at a step (FR-KB-03 AC1)', () => {
  it('a branch made at step 2 of a 4 step scenario stores only its own steps from the fork on', () => {
    const data = load()
    const [a, b, c, d, e, f] = data.nodes.slice(0, 6)
    let draft = newDraft('pos')
    for (const n of [a, b, c, d]) draft = addStep(dataScenarios(data), draft, n!.id).draft!
    draft = { ...draft, title: 'Gốc' }
    expect(validateDraft(dataScenarios(data), draft)).toBeNull()
    const parent = scenarios().create(projectId, {
      type: draft.type,
      title: draft.title,
      steps: draft.steps
    })

    const now = load()
    let branch = branchDraft(parent.scenario.id, b!.id, 'alt')
    for (const n of [e, f]) branch = addStep(dataScenarios(now), branch, n!.id).draft!
    branch = { ...branch, title: 'Nhánh' }
    expect(validateDraft(dataScenarios(now), branch)).toBeNull()
    const child = scenarios().create(projectId, {
      type: branch.type,
      title: branch.title,
      parentId: branch.parentId,
      forkNodeId: branch.forkNodeId,
      steps: branch.steps
    })
    const saved = load()
    const own = saved.steps.filter((s) => s.scenarioId === child.scenario.id)
    expect(own.map((s) => s.nodeId)).toEqual([b!.id, e!.id, f!.id])
    expect(fullPath(dataScenarios(saved), child.scenario.id).map((s) => s.nodeId)).toEqual([
      a!.id,
      b!.id,
      e!.id,
      f!.id
    ])
  })

  it('a fork block outside the path of the parent is refused by the draft and by the service', () => {
    const data = load()
    const p01 = byKey(data, 'P-01')
    const onPath = new Set(data.steps.filter((s) => s.scenarioId === p01.id).map((s) => s.nodeId))
    const off = data.nodes.find((n) => !onPath.has(n.id))!
    const draft = addStep(dataScenarios(data), { ...newDraft('alt'), parentId: p01.id }, off.id)
    expect(draft.problem).toBe('fork-not-on-path')
    expect(() =>
      scenarios().create(projectId, {
        type: 'alt',
        title: 'Sai',
        parentId: p01.id,
        forkNodeId: off.id,
        steps: [{ nodeId: off.id }]
      })
    ).toThrow()
  })
})
