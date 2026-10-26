import {
  LIMITS,
  SCENARIO_TYPES,
  VIA_TYPES,
  type GroupData,
  type LinkData,
  type NodeData,
  type RestoreBundle,
  type RestoreResult
} from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as groups from '../repo/groups'
import * as links from '../repo/links'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import * as scenarios from '../repo/scenarios'
import { finite, freeText, intArg, nullableText, oneOf, plainObject, text } from './fields'
import type { ServiceOptions } from './node'

const list = (value: unknown, field: string): unknown[] => {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new DiagramError('INVALID_ARGUMENT', `${field} must be a list`)
  return value
}

const optionalId = (value: unknown, field: string): number | undefined =>
  value === undefined || value === null ? undefined : intArg(value, field)

/**
 * Puts rows back or inserts copies of them, in one transaction (TDD 8.8). Undo of a delete, redo
 * of a create, and paste all go through here. Nothing is guessed: a key that is already taken is
 * an error and the whole bundle is rolled back.
 */
export function createHistoryService(ctx: DiagramContext, options: ServiceOptions = {}) {
  const { db, logger } = ctx
  const now = options.now ?? (() => new Date())

  return {
    restore(rawProjectId: unknown, rawBundle: unknown): RestoreResult {
      const project = projects.getProject(db, intArg(rawProjectId, 'projectId'))
      if (!project) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
      const bundle = plainObject(rawBundle, 'bundle') as RestoreBundle & Record<string, unknown>
      const stamp = now().toISOString()

      return db.transaction((): RestoreResult => {
        const result: RestoreResult = { groups: [], nodes: [], links: [] }

        // groups
        const groupKeys = new Set(groups.groupKeys(db, project.id))
        for (const raw of list(bundle.groups, 'groups')) {
          const g = plainObject(raw, 'group')
          const id = optionalId(g['id'], 'group.id')
          if (id !== undefined && groups.getGroup(db, id)) continue
          const key = text(g['key'], 'group.key', LIMITS.id, true)
          if (groupKeys.has(key)) throw new DiagramError('KEY_DUPLICATE', 'Group key is taken')
          groupKeys.add(key)
          const frame =
            g['frame'] === null || g['frame'] === undefined
              ? null
              : plainObject(g['frame'], 'frame')
          const newId = groups.insertGroup(db, {
            ...(id !== undefined ? { id } : {}),
            projectId: project.id,
            key,
            title: text(g['title'], 'group.title', LIMITS.title, true),
            fsFile: nullableText(g['fsFile'], 'group.fsFile', 260),
            sortOrder: finite(g['sortOrder'] ?? 0, 'group.sortOrder'),
            collapsed: g['collapsed'] === true,
            frame: frame
              ? {
                  x: finite(frame['x'], 'x'),
                  y: finite(frame['y'], 'y'),
                  w: finite(frame['w'], 'w'),
                  h: finite(frame['h'], 'h')
                }
              : null
          })
          const row = groups.getGroup(db, newId)
          if (row) {
            const { projectId: _p, ...data } = row
            void _p
            result.groups.push(data as GroupData)
          }
        }

        // blocks
        const nodeKeys = new Set(nodes.nodeKeys(db, project.id))
        const insertedKeys: string[] = []
        for (const raw of list(bundle.nodes, 'nodes')) {
          const n = plainObject(raw, 'node')
          const id = optionalId(n['id'], 'node.id')
          const key = text(n['key'], 'node.key', LIMITS.id, true)
          if (nodeKeys.has(key)) throw new DiagramError('KEY_DUPLICATE', 'Block key is taken')
          nodeKeys.add(key)
          const groupId =
            n['groupId'] === null || n['groupId'] === undefined
              ? null
              : intArg(n['groupId'], 'node.groupId')
          if (groupId !== null && !groups.getGroup(db, groupId)) {
            throw new DiagramError('GROUP_NOT_FOUND', 'Group not found')
          }
          const chips = Array.isArray(n['chips'])
            ? n['chips'].map((c) => text(c, 'chip', LIMITS.chip))
            : []
          const newId = nodes.insertNode(
            db,
            project.id,
            {
              key,
              type: oneOf(
                n['type'],
                ['fnc', 'req', 'tech', 'ext', 'start', 'end', 'cond', 'note'] as const,
                'type'
              ),
              subtype: nullableText(n['subtype'], 'subtype', 20),
              code: text(n['code'], 'code', LIMITS.code) || key,
              title: text(n['title'], 'title', LIMITS.title, true),
              body: freeText(n['body'] ?? '', 'body', LIMITS.body),
              fixText: text(n['fixText'] ?? '', 'fixText', LIMITS.fix),
              chips,
              fsFile: nullableText(n['fsFile'], 'fsFile', 260),
              fsSection: nullableText(n['fsSection'], 'fsSection', LIMITS.section),
              groupId,
              x: finite(n['x'], 'x'),
              y: finite(n['y'], 'y'),
              hasLayout: n['hasLayout'] !== false,
              collapsed: n['collapsed'] === true
            },
            stamp,
            id
          )
          insertedKeys.push(key)
          const row = nodes.getNode(db, newId)
          if (row) {
            const { projectId: _p, ...data } = row
            void _p
            result.nodes.push(data as NodeData)
          }
        }

        const idOfKey = nodes.keyToId(db, project.id)
        const nodeId = (key: unknown, field: string): number => {
          const id = typeof key === 'string' ? idOfKey.get(key) : undefined
          if (id === undefined)
            throw new DiagramError('NODE_NOT_FOUND', `Block not found: ${field}`)
          return id
        }

        // images and pins of restored blocks
        for (const raw of list(bundle.images, 'images')) {
          const i = plainObject(raw, 'image')
          db.prepare(
            `INSERT OR IGNORE INTO dg_images (id, node_id, rel_path, width, height, caption, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            intArg(i['id'], 'image.id'),
            nodeId(i['nodeKey'], 'image'),
            text(i['relPath'], 'relPath', 400, true),
            intArg(i['width'], 'width'),
            intArg(i['height'], 'height'),
            text(i['caption'] ?? '', 'caption', 300),
            finite(i['sortOrder'] ?? 0, 'sortOrder')
          )
        }
        for (const raw of list(bundle.pins, 'pins')) {
          const p = plainObject(raw, 'pin')
          db.prepare(
            `INSERT OR IGNORE INTO dg_pins (id, image_id, x_pct, y_pct, note, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(
            intArg(p['id'], 'pin.id'),
            intArg(p['imageId'], 'pin.imageId'),
            finite(p['xPct'], 'xPct'),
            finite(p['yPct'], 'yPct'),
            text(p['note'] ?? '', 'note', 300),
            finite(p['sortOrder'] ?? 0, 'sortOrder')
          )
        }

        // channels
        const linkKeys = new Set(links.linkKeys(db, project.id))
        for (const raw of list(bundle.links, 'links')) {
          const l = plainObject(raw, 'link')
          const key = text(l['key'], 'link.key', LIMITS.id, true)
          if (linkKeys.has(key)) throw new DiagramError('KEY_DUPLICATE', 'Channel key is taken')
          linkKeys.add(key)
          const id = optionalId(l['id'], 'link.id')
          const newId = links.insertLink(db, {
            ...(id !== undefined ? { id } : {}),
            projectId: project.id,
            key,
            fromNode: nodeId(l['fromKey'], 'link.from'),
            toNode: nodeId(l['toKey'], 'link.to'),
            via: oneOf(l['via'], VIA_TYPES, 'via'),
            label: text(l['label'] ?? '', 'label', LIMITS.label),
            note: text(l['note'] ?? '', 'note', LIMITS.note),
            sortOrder:
              l['sortOrder'] === undefined
                ? links.nextSortOrder(db, project.id)
                : finite(l['sortOrder'], 'sortOrder')
          })
          const row = links.getLink(db, newId)
          if (row) {
            const { projectId: _p, ...data } = row
            void _p
            result.links.push(data as LinkData)
          }
        }

        // scenarios put back under their old ids
        const scenarioKeys = new Set(scenarios.scenarioKeys(db, project.id))
        for (const raw of list(bundle.scenarios, 'scenarios')) {
          const sc = plainObject(raw, 'scenario')
          const id = intArg(sc['id'], 'scenario.id')
          if (scenarios.getScenario(db, id)) continue
          const key = text(sc['key'], 'scenario.key', LIMITS.id, true)
          if (scenarioKeys.has(key))
            throw new DiagramError('KEY_DUPLICATE', 'Scenario key is taken')
          scenarioKeys.add(key)
          const parentId =
            sc['parentId'] === null || sc['parentId'] === undefined
              ? null
              : intArg(sc['parentId'], 'scenario.parentId')
          if (parentId !== null && !scenarios.getScenario(db, parentId)) {
            throw new DiagramError('SCENARIO_NOT_FOUND', 'Parent scenario not found')
          }
          scenarios.insertScenario(db, {
            id,
            projectId: project.id,
            key,
            type: oneOf(sc['type'], SCENARIO_TYPES, 'type'),
            title: text(sc['title'], 'scenario.title', LIMITS.title, true),
            parentId,
            forkNodeId:
              sc['forkNodeKey'] === null || sc['forkNodeKey'] === undefined
                ? null
                : nodeId(sc['forkNodeKey'], 'scenario.fork'),
            sortOrder: finite(sc['sortOrder'] ?? 0, 'scenario.sortOrder')
          })
        }

        // scenarios: complete step lists and fork points
        for (const raw of list(bundle.steps, 'steps')) {
          const s = plainObject(raw, 'steps')
          const scenarioId = intArg(s['scenarioId'], 'scenarioId')
          if (!scenarios.getScenario(db, scenarioId)) {
            throw new DiagramError('SCENARIO_NOT_FOUND', 'Scenario not found')
          }
          const steps = list(s['steps'], 'steps.steps').map((x) => {
            const o = plainObject(x, 'step')
            return {
              nodeId: nodeId(o['nodeKey'], 'step'),
              note: text(o['note'] ?? '', 'note', LIMITS.stepNote)
            }
          })
          scenarios.replaceSteps(db, scenarioId, steps)
        }
        for (const raw of list(bundle.forks, 'forks')) {
          const f = plainObject(raw, 'fork')
          const scenarioId = intArg(f['scenarioId'], 'scenarioId')
          if (!scenarios.getScenario(db, scenarioId)) {
            throw new DiagramError('SCENARIO_NOT_FOUND', 'Scenario not found')
          }
          const parentId =
            f['parentId'] === null || f['parentId'] === undefined
              ? null
              : intArg(f['parentId'], 'parentId')
          const forkNodeId =
            f['forkNodeKey'] === null || f['forkNodeKey'] === undefined
              ? null
              : nodeId(f['forkNodeKey'], 'fork')
          scenarios.setParent(db, scenarioId, parentId, forkNodeId)
        }

        logger.info('restored', { nodes: result.nodes.length, links: result.links.length })
        return result
      })()
    }
  }
}

export type HistoryService = ReturnType<typeof createHistoryService>
