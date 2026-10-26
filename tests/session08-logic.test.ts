import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dataScenarios } from '../src/shared/diagram/flowmap/convert'
import { pickPeek } from '../src/shared/diagram/pinpick'
import {
  createPlayer,
  easeInOutQuad,
  PLAY_TIMING,
  type PlayClock,
  type PlayState
} from '../src/shared/diagram/player'
import {
  addStep,
  branchDraft,
  draftOf,
  draftPath,
  inheritedSteps,
  moveStep,
  newDraft,
  removeStep,
  setParent,
  setStepNote,
  validateDraft
} from '../src/shared/diagram/recorder'
import { fullPath, type ScenarioNode } from '../src/shared/diagram/scenario'
import { forkMarks, lineOffset, pathSegments, treeOrder } from '../src/shared/diagram/scenarioView'
import { createProjectService } from '../src/main/diagram/services/project'
import { findSampleFile, seedSampleProject } from '../src/main/diagram/seed'
import type { ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'

/** A clock that only moves when the test says so. */
function fakeClock() {
  let time = 0
  let next = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  const clock: PlayClock = {
    now: () => time,
    setTimeout(fn, ms) {
      const id = next++
      timers.set(id, { at: time + ms, fn })
      return id
    },
    clearTimeout(handle) {
      timers.delete(handle as number)
    }
  }
  return {
    clock,
    pending: () => timers.size,
    advance(ms: number) {
      const target = time + ms
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        time = due[1].at
        due[1].fn()
      }
      time = target
    }
  }
}

function recorded(stepCount: number, extra: { travel?: boolean; speed?: 0.5 | 1 | 2 } = {}) {
  const fake = fakeClock()
  const log: string[] = []
  const player = createPlayer({
    stepCount,
    clock: fake.clock,
    ...extra,
    hooks: {
      step: (i) => log.push(`step ${i}`),
      travel: (a, b) => log.push(`travel ${a}>${b}`),
      state: (s: PlayState) => log.push(`state ${s}`)
    }
  })
  return { fake, log, player }
}

const STEP_MS = PLAY_TIMING.hold + PLAY_TIMING.travel

describe('Play controller (TDD 8.5)', () => {
  it('runs the steps in order, with a travel between each pair and none after the last', () => {
    const { fake, log, player } = recorded(3)
    player.start()
    fake.advance(STEP_MS * 2 + PLAY_TIMING.hold)
    expect(log).toEqual([
      'state playing',
      'step 0',
      'travel 0>1',
      'step 1',
      'travel 1>2',
      'step 2',
      'state finished'
    ])
    expect(player.state()).toBe('finished')
    expect(fake.pending()).toBe(0)
  })

  it('holds a step for 1500 ms, then travels for 750 ms', () => {
    const { fake, log, player } = recorded(2)
    player.start()
    fake.advance(PLAY_TIMING.hold - 1)
    expect(log).not.toContain('travel 0>1')
    fake.advance(1)
    expect(log).toContain('travel 0>1')
    expect(player.phase()).toBe('travel')
    fake.advance(PLAY_TIMING.travel - 1)
    expect(player.index()).toBe(0)
    fake.advance(1)
    expect(player.index()).toBe(1)
  })

  it('at 2x the same steps take half the time, at 0.5x twice as long', () => {
    const fast = recorded(3, { speed: 2 })
    fast.player.start()
    fast.fake.advance(STEP_MS / 2 - 1)
    expect(fast.player.index()).toBe(0)
    fast.fake.advance(1)
    expect(fast.player.index()).toBe(1)
    fast.fake.advance(STEP_MS / 2)
    expect(fast.player.index()).toBe(2)
    expect(fast.player.cameraMs()).toBe(PLAY_TIMING.camera / 2)

    const slow = recorded(3, { speed: 0.5 })
    slow.player.start()
    slow.fake.advance(STEP_MS * 2 - 1)
    expect(slow.player.index()).toBe(0)
    slow.fake.advance(1)
    expect(slow.player.index()).toBe(1)
  })

  it('stopping half way cancels every timer and nothing runs again', () => {
    const { fake, log, player } = recorded(5)
    player.start()
    fake.advance(PLAY_TIMING.hold + 100)
    expect(fake.pending()).toBe(1)
    player.stop()
    expect(fake.pending()).toBe(0)
    const before = log.length
    fake.advance(60_000)
    expect(log.slice(before)).toEqual([])
    expect(player.state()).toBe('stopped')
    player.resume()
    player.start()
    expect(player.state()).toBe('stopped')
    expect(fake.pending()).toBe(0)
  })

  it('pause freezes the phase and resume carries on with the time that was left', () => {
    const { fake, player } = recorded(3)
    player.start()
    fake.advance(1000)
    player.pause()
    expect(fake.pending()).toBe(0)
    expect(player.progress()).toBeCloseTo(1000 / PLAY_TIMING.hold)
    fake.advance(10_000)
    expect(player.index()).toBe(0)
    expect(player.progress()).toBeCloseTo(1000 / PLAY_TIMING.hold)
    player.resume()
    fake.advance(499)
    expect(player.phase()).toBe('hold')
    fake.advance(1)
    expect(player.phase()).toBe('travel')
  })

  it('changing the speed in the middle of a phase rescales what is left', () => {
    const { fake, player } = recorded(3)
    player.start()
    fake.advance(750)
    player.setSpeed(2)
    // half of the 1500 ms hold is done, the other half now takes 375 ms
    fake.advance(374)
    expect(player.phase()).toBe('hold')
    fake.advance(1)
    expect(player.phase()).toBe('travel')
    expect(player.progress()).toBe(0)
  })

  it('reduced motion: no travel phase, the next step follows the hold', () => {
    const { fake, log, player } = recorded(3, { travel: false })
    player.start()
    fake.advance(PLAY_TIMING.hold * 3)
    expect(log.filter((l) => l.startsWith('travel'))).toEqual([])
    expect(log.filter((l) => l.startsWith('step'))).toEqual(['step 0', 'step 1', 'step 2'])
    expect(player.state()).toBe('finished')
  })

  it('no steps finishes at once, one step plays its hold and finishes', () => {
    const none = recorded(0)
    none.player.start()
    expect(none.player.state()).toBe('finished')
    const one = recorded(1)
    one.player.start()
    expect(one.player.state()).toBe('playing')
    one.fake.advance(PLAY_TIMING.hold)
    expect(one.player.state()).toBe('finished')
  })

  it('eases in and out with a quadratic curve', () => {
    expect(easeInOutQuad(0)).toBe(0)
    expect(easeInOutQuad(0.25)).toBeCloseTo(0.125)
    expect(easeInOutQuad(0.5)).toBe(0.5)
    expect(easeInOutQuad(0.75)).toBeCloseTo(0.875)
    expect(easeInOutQuad(1)).toBe(1)
    expect(easeInOutQuad(-3)).toBe(0)
    expect(easeInOutQuad(4)).toBe(1)
  })
})

describe('scenario view helpers', () => {
  it('draws compared lines 7 px apart', () => {
    expect(lineOffset(0, 1)).toBe(0)
    expect(lineOffset(0, 2)).toBe(-3.5)
    expect(lineOffset(1, 2)).toBe(3.5)
    expect(lineOffset(2, 3)).toBe(7)
  })

  it('skips segments between two steps on the same block', () => {
    expect(pathSegments([{ nodeId: 1 }, { nodeId: 1 }, { nodeId: 2 }, { nodeId: 3 }])).toEqual([
      [1, 2],
      [2, 3]
    ])
    expect(pathSegments([{ nodeId: 1 }])).toEqual([])
  })

  it('orders a tree parent first and indents each level, an orphan becomes a root', () => {
    const list = treeOrder([
      { id: 5, parentId: 4, sortOrder: 4 },
      { id: 1, parentId: null, sortOrder: 0 },
      { id: 3, parentId: 1, sortOrder: 2 },
      { id: 2, parentId: 1, sortOrder: 1 },
      { id: 4, parentId: 3, sortOrder: 3 },
      { id: 9, parentId: 77, sortOrder: 9 }
    ])
    expect(list).toEqual([
      { id: 1, depth: 0 },
      { id: 2, depth: 1 },
      { id: 3, depth: 1 },
      { id: 4, depth: 2 },
      { id: 5, depth: 3 },
      { id: 9, depth: 0 }
    ])
  })

  it('does not lose scenarios that form a parent loop', () => {
    const list = treeOrder([
      { id: 1, parentId: 2, sortOrder: 0 },
      { id: 2, parentId: 1, sortOrder: 1 }
    ])
    expect(list.map((x) => x.id).sort()).toEqual([1, 2])
  })

  it('marks the fork block of the selected branches only', () => {
    const scenarios = [
      { id: 1, key: 'P-01', forkNodeId: null },
      { id: 2, key: 'A-01', forkNodeId: 10 },
      { id: 3, key: 'N-05', forkNodeId: 10 },
      { id: 4, key: 'N-01', forkNodeId: 20 }
    ]
    const marks = forkMarks(scenarios, [1, 2, 3])
    expect([...marks.entries()]).toEqual([[10, ['A-01', 'N-05']]])
  })

  it('picks the image and pin for a Play card by the words of the step note', () => {
    const images = [
      { imageId: 1, pins: [{ id: 1, note: 'Nút đăng nhập' }] },
      {
        imageId: 2,
        pins: [
          { id: 2, note: 'Màn hình chờ' },
          { id: 3, note: 'SingPass lỗi hoặc Parent hủy' }
        ]
      }
    ]
    expect(pickPeek(images, 'SingPass lỗi, báo MSG-0802')).toEqual({ imageId: 2, pinIndex: 1 })
    // no word in common: the first pin of the first image
    expect(pickPeek(images, 'xyz')).toEqual({ imageId: 1, pinIndex: 0 })
    expect(pickPeek([{ imageId: 7, pins: [] }], 'abc')).toEqual({ imageId: 7, pinIndex: -1 })
    expect(pickPeek([], 'abc')).toBeNull()
  })
})

describe('scenario recorder rules (FR-KB-03, BR-06 to BR-08)', () => {
  const tree: ScenarioNode[] = [
    {
      id: 1,
      parentId: null,
      forkNodeId: null,
      steps: [10, 11, 12, 13].map((nodeId) => ({ nodeId, note: '' }))
    }
  ]

  it('a branch takes the first block it is given as its fork, and it must be on the parent path', () => {
    const draft = { ...newDraft('alt'), parentId: 1 }
    const bad = addStep(tree, draft, 99)
    expect(bad.problem).toBe('fork-not-on-path')
    const good = addStep(tree, draft, 12)
    expect(good.draft?.forkNodeId).toBe(12)
    expect(good.draft?.steps).toEqual([{ nodeId: 12, note: '' }])
    const more = addStep(tree, good.draft!, 99)
    expect(more.draft?.steps.map((s) => s.nodeId)).toEqual([12, 99])
  })

  it('the branch shows the parent steps before the fork as inherited', () => {
    const draft = branchDraft(1, 12)
    expect(inheritedSteps(tree, draft).map((s) => s.nodeId)).toEqual([10, 11])
    expect(draftPath(tree, draft).map((s) => s.nodeId)).toEqual([10, 11, 12])
  })

  it('the fork step cannot be removed or moved while others follow it (BR-08)', () => {
    let draft = branchDraft(1, 12)
    draft = addStep(tree, draft, 50).draft!
    draft = addStep(tree, draft, 51).draft!
    expect(removeStep(draft, 0).problem).toBe('first-step-not-fork')
    expect(moveStep(draft, 0, 2).problem).toBe('first-step-not-fork')
    expect(moveStep(draft, 2, 0).problem).toBe('first-step-not-fork')
    expect(moveStep(draft, 1, 2).draft?.steps.map((s) => s.nodeId)).toEqual([12, 51, 50])
    expect(removeStep(draft, 1).draft?.steps.map((s) => s.nodeId)).toEqual([12, 51])
    const only = removeStep(branchDraft(1, 12), 0).draft!
    expect(only.steps).toEqual([])
    expect(only.forkNodeId).toBeNull()
  })

  it('a root scenario can be reordered freely and keeps notes up to 160 characters', () => {
    let draft = newDraft('pos')
    for (const id of [1, 2, 3]) draft = addStep([], draft, id).draft!
    draft = moveStep(draft, 0, 2).draft!
    expect(draft.steps.map((s) => s.nodeId)).toEqual([2, 3, 1])
    draft = setStepNote(draft, 1, 'x'.repeat(200))
    expect(draft.steps[1]?.note).toHaveLength(160)
  })

  it('changing the parent re-checks the first step', () => {
    let draft = newDraft('alt')
    draft = addStep(tree, draft, 99).draft!
    expect(setParent(tree, draft, 1).problem).toBe('fork-not-on-path')
    draft = addStep(tree, newDraft('alt'), 11).draft!
    const withParent = setParent(tree, draft, 1).draft!
    expect(withParent.forkNodeId).toBe(11)
    expect(setParent(tree, withParent, null).draft?.forkNodeId).toBeNull()
  })

  it('save needs a title and a step, then applies the tree rules', () => {
    const draft = { ...newDraft('pos'), steps: [{ nodeId: 1, note: '' }] }
    expect(validateDraft(tree, draft)).toBe('title-empty')
    expect(validateDraft(tree, { ...draft, title: 'x', steps: [] })).toBe('no-steps')
    expect(validateDraft(tree, { ...draft, title: 'x' })).toBeNull()
    const branch = { ...branchDraft(1, 12), title: 'Nhánh' }
    expect(validateDraft(tree, branch)).toBeNull()
    // a fork block that is not on the parent path
    expect(
      validateDraft(tree, { ...branch, forkNodeId: 99, steps: [{ nodeId: 99, note: '' }] })
    ).toBe('fork-not-on-path')
  })

  it('editing a parent so that a branch below loses its fork is refused', () => {
    const withBranch: ScenarioNode[] = [
      ...tree,
      { id: 2, parentId: 1, forkNodeId: 13, steps: [{ nodeId: 13, note: '' }] }
    ]
    const edited = {
      ...draftOf({ id: 1, type: 'pos', title: 'P', parentId: null, forkNodeId: null }, [
        { nodeId: 10, note: '' },
        { nodeId: 11, note: '' }
      ])
    }
    expect(validateDraft(withBranch, edited)).toBeNull()
    expect(validateDraft(withBranch, edited, [2])).toBe('fork-not-on-path')
  })
})

describe('Play and tree on the sample project', () => {
  let kho: ReturnType<typeof makeKho>
  let data: ProjectData
  beforeEach(() => {
    kho = makeKho()
    const ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
    const file = findSampleFile(process.cwd())
    if (!file) throw new Error('sample not found')
    data = createProjectService(ctx).load(seedSampleProject(ctx, file))
  })
  afterEach(() => kho.cleanup())

  const idOf = (key: string) => data.scenarios.find((s) => s.key === key)!.id

  it('the tree puts E-02 under N-05, N-05 under A-01 and A-01 under P-01', () => {
    const order = treeOrder(data.scenarios)
    const keyAt = (i: number) => data.scenarios.find((s) => s.id === order[i]?.id)?.key
    const depth = (key: string) => order.find((o) => o.id === idOf(key))?.depth
    expect(depth('P-01')).toBe(0)
    expect(depth('A-01')).toBe(1)
    expect(depth('N-05')).toBe(2)
    expect(depth('E-02')).toBe(3)
    const at = (key: string) => order.findIndex((o) => o.id === idOf(key))
    expect(at('A-01')).toBeGreaterThan(at('P-01'))
    expect(at('N-05')).toBe(at('A-01') + 1)
    expect(at('E-02')).toBe(at('N-05') + 1)
    expect(order).toHaveLength(9)
    expect(keyAt(0)).toBe('P-01')
  })

  it('P-01 plays 13 steps and N-05 plays 14, ending on the End block', () => {
    const tree = dataScenarios(data)
    expect(fullPath(tree, idOf('P-01'))).toHaveLength(13)
    const n05 = fullPath(tree, idOf('N-05'))
    expect(n05).toHaveLength(14)
    const last = data.nodes.find((n) => n.id === n05[n05.length - 1]?.nodeId)
    expect(last?.type).toBe('end')
    expect(last?.title).toContain('Invoice')
  })

  it('selecting A-01 and N-05 marks the two fork blocks', () => {
    const marks = forkMarks(data.scenarios, [idOf('A-01'), idOf('N-05')])
    const codes = new Map(data.nodes.map((n) => [n.id, n.key]))
    expect([...marks.keys()].map((id) => codes.get(id)).sort()).toEqual(['F9B', 'F9D'])
  })
})
