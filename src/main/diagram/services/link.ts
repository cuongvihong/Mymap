import { deriveLinkKey } from '../../../shared/diagram/ids'
import { checkLinkRules, LINK_RULE_TEXT } from '../../../shared/diagram/linkrules'
import { LIMITS, VIA_TYPES, type LinkData } from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as links from '../repo/links'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import { intArg, intList, key, oneOf, plainObject, text } from './fields'
import type { ServiceOptions } from './node'

export function createLinkService(ctx: DiagramContext, _options: ServiceOptions = {}) {
  const { db, logger } = ctx

  const requireLink = (id: unknown): links.LinkRecord => {
    const l = links.getLink(db, intArg(id, 'id'))
    if (!l) throw new DiagramError('LINK_NOT_FOUND', 'Channel not found')
    return l
  }

  const plain = (l: links.LinkRecord): LinkData => {
    const { projectId: _p, ...data } = l
    void _p
    return data
  }

  /** FR-LK-03. Both blocks must be in the project. */
  function checkEnds(projectId: number, fromNode: number, toNode: number, via: LinkData['via']) {
    const from = nodes.getNode(db, fromNode)
    const to = nodes.getNode(db, toNode)
    if (!from || !to || from.projectId !== projectId || to.projectId !== projectId) {
      throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
    }
    if (from.id === to.id)
      throw new DiagramError('LINK_SELF', 'A channel cannot join a block to itself')
    const violation = checkLinkRules(from.type, to.type, via)[0]
    if (violation) throw new DiagramError('LINK_RULE', LINK_RULE_TEXT[violation.reason])
    return { from, to }
  }

  return {
    create(projectId: unknown, rawInput: unknown): LinkData {
      const record = projects.getProject(db, intArg(projectId, 'projectId'))
      if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
      const input = plainObject(rawInput, 'input')
      const fromNode = intArg(input['fromNode'], 'fromNode')
      const toNode = intArg(input['toNode'], 'toNode')
      const via = oneOf(input['via'], VIA_TYPES, 'via')
      const label = input['label'] === undefined ? '' : text(input['label'], 'label', LIMITS.label)
      const note = input['note'] === undefined ? '' : text(input['note'], 'note', LIMITS.note)
      const { from, to } = checkEnds(record.id, fromNode, toNode, via)
      const taken = new Set(links.linkKeys(db, record.id))
      const linkKey =
        input['key'] === undefined
          ? deriveLinkKey(from.key, to.key, via, taken)
          : key(input['key'], taken)
      const id = links.insertLink(db, {
        projectId: record.id,
        key: linkKey,
        fromNode,
        toNode,
        via,
        label,
        note,
        sortOrder: links.nextSortOrder(db, record.id)
      })
      logger.info('link created', { id })
      return plain(requireLink(id))
    },

    update(id: unknown, rawPatch: unknown): LinkData {
      const l = requireLink(id)
      const patch = plainObject(rawPatch, 'patch')
      const next = {
        fromNode: 'fromNode' in patch ? intArg(patch['fromNode'], 'fromNode') : l.fromNode,
        toNode: 'toNode' in patch ? intArg(patch['toNode'], 'toNode') : l.toNode,
        via: 'via' in patch ? oneOf(patch['via'], VIA_TYPES, 'via') : l.via,
        label: 'label' in patch ? text(patch['label'], 'label', LIMITS.label) : l.label,
        note: 'note' in patch ? text(patch['note'], 'note', LIMITS.note) : l.note
      }
      checkEnds(l.projectId, next.fromNode, next.toNode, next.via)
      links.updateLink(db, l.id, next)
      return plain(requireLink(l.id))
    },

    remove(rawIds: unknown): null {
      const ids = intList(rawIds, 'ids')
      for (const id of ids) requireLink(id)
      db.transaction(() => links.deleteLinks(db, ids))()
      return null
    }
  }
}

export type LinkService = ReturnType<typeof createLinkService>
