import { newScenarioKey } from '../../../shared/diagram/ids'
import {
  checkScenario,
  descendants,
  promoteChildren,
  type ScenarioNode,
  type ScenarioProblem
} from '../../../shared/diagram/scenario'
import {
  LIMITS,
  SCENARIO_TYPES,
  type AffectedScenario,
  type ChildPolicy,
  type ScenarioData,
  type ScenarioRemoveResult,
  type ScenarioStepInput,
  type ScenarioWithSteps,
  type StepData
} from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import * as scenarios from '../repo/scenarios'
import { finite, intArg, key, oneOf, plainObject, text } from './fields'
import type { ServiceOptions } from './node'
import { scenarioNodes } from './scenarioTree'

const PROBLEM_TEXT: Record<ScenarioProblem, string> = {
  cycle: 'A scenario cannot be its own ancestor (BR-07)',
  'parent-missing': 'Parent scenario not found',
  'fork-missing': 'A branch needs a fork block (BR-06)',
  'fork-without-parent': 'A fork block only makes sense with a parent scenario',
  'fork-not-on-path': 'The fork block is not on the full path of the parent (BR-06)',
  'first-step-not-fork': 'The first step of a branch must be the fork block (BR-08)'
}

export function createScenarioService(ctx: DiagramContext, _options: ServiceOptions = {}) {
  const { db, logger } = ctx

  const requireProject = (id: unknown): projects.ProjectRecord => {
    const record = projects.getProject(db, intArg(id, 'projectId'))
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return record
  }

  const requireScenario = (id: unknown): scenarios.ScenarioRecord => {
    const s = scenarios.getScenario(db, intArg(id, 'id'))
    if (!s) throw new DiagramError('SCENARIO_NOT_FOUND', 'Scenario not found')
    return s
  }

  const plain = (s: scenarios.ScenarioRecord): ScenarioData => {
    const { projectId: _p, ...data } = s
    void _p
    return data
  }

  function nodeInProject(projectId: number, nodeId: unknown): number {
    const n = nodes.getNode(db, intArg(nodeId, 'nodeId'))
    if (!n || n.projectId !== projectId) throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
    return n.id
  }

  function cleanSteps(projectId: number, raw: unknown): { nodeId: number; note: string }[] {
    if (!Array.isArray(raw)) throw new DiagramError('INVALID_ARGUMENT', 'steps must be a list')
    return raw.map((r) => {
      const o = plainObject(r, 'step') as unknown as ScenarioStepInput
      return {
        nodeId: nodeInProject(projectId, o.nodeId),
        note: o.note === undefined ? '' : text(o.note, 'note', LIMITS.stepNote)
      }
    })
  }

  /** Applies a hypothetical change to the tree and throws when the scenario or a branch below it breaks a rule. */
  function assertTree(projectId: number, change: ScenarioNode): void {
    const current = scenarioNodes(db, projectId).filter((s) => s.id !== change.id)
    const tree = [...current, change]
    const names = new Map(scenarios.listScenarios(db, projectId).map((s) => [s.id, s.key]))
    for (const id of [change.id, ...descendants(tree, change.id)]) {
      const problem = checkScenario(tree, id)[0]
      if (problem) {
        const where = id === change.id ? '' : ` (branch ${names.get(id as number) ?? id})`
        throw new DiagramError('SCENARIO_RULE', `${PROBLEM_TEXT[problem]}${where}`)
      }
    }
  }

  function withSteps(id: number): ScenarioWithSteps {
    return { scenario: plain(requireScenario(id)), steps: scenarios.stepsOf(db, id) }
  }

  return {
    create(projectId: unknown, rawInput: unknown): ScenarioWithSteps {
      const record = requireProject(projectId)
      const input = plainObject(rawInput, 'input')
      const type = oneOf(input['type'], SCENARIO_TYPES, 'type')
      const title = text(input['title'], 'title', LIMITS.title, true)
      const taken = new Set(scenarios.scenarioKeys(db, record.id))
      const scenarioKey =
        input['key'] === undefined ? newScenarioKey(type, taken) : key(input['key'], taken)

      return db.transaction(() => {
        let parentId: number | null = null
        let forkNodeId: number | null = null
        if (input['parentId'] !== undefined && input['parentId'] !== null) {
          const parent = requireScenario(input['parentId'])
          if (parent.projectId !== record.id) {
            throw new DiagramError('SCENARIO_NOT_FOUND', 'Parent scenario not found')
          }
          parentId = parent.id
        }
        if (input['forkNodeId'] !== undefined && input['forkNodeId'] !== null) {
          forkNodeId = nodeInProject(record.id, input['forkNodeId'])
        }
        const steps = input['steps'] === undefined ? [] : cleanSteps(record.id, input['steps'])
        // -1 stands for the scenario that is about to be inserted
        assertTree(record.id, { id: -1, parentId, forkNodeId, steps })

        const id = scenarios.insertScenario(db, {
          projectId: record.id,
          key: scenarioKey,
          type,
          title,
          parentId,
          forkNodeId,
          sortOrder: scenarios.nextSortOrder(db, record.id)
        })
        scenarios.replaceSteps(db, id, steps)
        logger.info('scenario created', { id })
        return withSteps(id)
      })()
    },

    update(id: unknown, rawPatch: unknown): ScenarioData {
      const s = requireScenario(id)
      const patch = plainObject(rawPatch, 'patch')
      return db.transaction(() => {
        const type = 'type' in patch ? oneOf(patch['type'], SCENARIO_TYPES, 'type') : s.type
        const title = 'title' in patch ? text(patch['title'], 'title', LIMITS.title, true) : s.title
        const sortOrder =
          'sortOrder' in patch ? finite(patch['sortOrder'], 'sortOrder') : s.sortOrder

        let parentId = s.parentId
        let forkNodeId = s.forkNodeId
        if ('parentId' in patch) {
          if (patch['parentId'] === null) {
            parentId = null
            forkNodeId = null
          } else {
            const parent = requireScenario(patch['parentId'])
            if (parent.projectId !== s.projectId) {
              throw new DiagramError('SCENARIO_NOT_FOUND', 'Parent scenario not found')
            }
            parentId = parent.id
          }
        }
        if ('forkNodeId' in patch) {
          forkNodeId =
            patch['forkNodeId'] === null ? null : nodeInProject(s.projectId, patch['forkNodeId'])
        }
        if ('parentId' in patch || 'forkNodeId' in patch) {
          const steps = scenarios.stepsOf(db, s.id).map((x) => ({ nodeId: x.nodeId, note: x.note }))
          assertTree(s.projectId, { id: s.id, parentId, forkNodeId, steps })
        }
        scenarios.updateScenario(db, s.id, { type, title, parentId, forkNodeId, sortOrder })
        return plain(requireScenario(s.id))
      })()
    },

    /**
     * cascade: the scenario and every branch below it are deleted.
     * promote: branches move up to the parent of the deleted scenario and keep their full paths (FR-KB-07).
     */
    remove(id: unknown, policy: unknown): ScenarioRemoveResult {
      const s = requireScenario(id)
      const childPolicy = oneOf(
        policy,
        ['cascade', 'promote'] as const,
        'childPolicy'
      ) as ChildPolicy
      return db.transaction(() => {
        const tree = scenarioNodes(db, s.projectId)
        const names = new Map(scenarios.listScenarios(db, s.projectId).map((x) => [x.id, x]))
        const describe = (sid: number | string): AffectedScenario => {
          const found = names.get(sid as number)
          return { id: found?.id ?? Number(sid), key: found?.key ?? '', title: found?.title ?? '' }
        }
        if (childPolicy === 'cascade') {
          const gone = [s.id, ...descendants(tree, s.id).map((x) => x as number)]
          scenarios.deleteScenarios(db, gone)
          return { removed: gone, promoted: [] }
        }
        const promoted = promoteChildren(tree, s.id)
        for (const p of promoted) {
          scenarios.setParent(
            db,
            p.id as number,
            p.parentId as number | null,
            p.forkNodeId as number | null
          )
          scenarios.replaceSteps(
            db,
            p.id as number,
            p.steps.map((x) => ({ nodeId: x.nodeId as number, note: x.note }))
          )
        }
        scenarios.deleteScenarios(db, [s.id])
        return { removed: [s.id], promoted: promoted.map((p) => describe(p.id)) }
      })()
    },

    setSteps(id: unknown, rawSteps: unknown): StepData[] {
      const s = requireScenario(id)
      return db.transaction(() => {
        const steps = cleanSteps(s.projectId, rawSteps)
        assertTree(s.projectId, { id: s.id, parentId: s.parentId, forkNodeId: s.forkNodeId, steps })
        scenarios.replaceSteps(db, s.id, steps)
        return scenarios.stepsOf(db, s.id)
      })()
    }
  }
}

export type ScenarioService = ReturnType<typeof createScenarioService>
