import { treeOrder } from '../../../../shared/diagram/scenarioView'
import {
  NODE_TYPES,
  VIA_TYPES,
  type NodeType,
  type ProjectData,
  type ScenarioType,
  type ViaType
} from '../../../../shared/diagram/types'
import { diagramStrings as t } from '../strings'

/** Data the sidebar renders. Session 01 feeds it from a static fixture, later sessions from the store. */
export interface SidebarFsDoc {
  /** Database id of the group. */
  groupId: number
  id: string
  title: string
  file: string
}

export interface SidebarScenario {
  id: number
  code: string
  title: string
  type: ScenarioType
  /** Short line under the title, for example "Negative · rẽ tại R1 · F01". */
  meta: string
  /** 0 for a root scenario, 1 for a branch, 2 for a branch of a branch. */
  depth: number
}

export interface SidebarBlock {
  id: number
  code: string
  title: string
  type: NodeType
}

export interface SidebarModel {
  fsDocs: SidebarFsDoc[]
  scenarios: SidebarScenario[]
  blocks: SidebarBlock[]
  channels: ViaType[]
  nodeTypes: NodeType[]
}

/** Build the sidebar content from a loaded project. Legends are static, lists come from the data. */
export function buildSidebarModel(data: ProjectData): SidebarModel {
  const scenarioById = new Map(data.scenarios.map((s) => [s.id, s]))
  const nodeCode = new Map(data.nodes.map((n) => [n.id, n.code]))
  const metaOf = (s: ProjectData['scenarios'][number]): string => {
    const fork = s.forkNodeId !== null ? nodeCode.get(s.forkNodeId) : undefined
    return fork ? `${t.scenarioType[s.type]} · rẽ tại ${fork}` : t.scenarioType[s.type]
  }
  const order = treeOrder(data.scenarios)
  return {
    fsDocs: data.groups
      .filter((g) => g.fsFile)
      .map((g) => ({ groupId: g.id, id: g.key, title: g.title, file: g.fsFile as string })),
    scenarios: order.flatMap(({ id, depth }) => {
      const s = scenarioById.get(id)
      return s
        ? [{ id: s.id, code: s.key, title: s.title, type: s.type, meta: metaOf(s), depth }]
        : []
    }),
    blocks: data.nodes.map((n) => ({ id: n.id, code: n.code, title: n.title, type: n.type })),
    channels: [...VIA_TYPES],
    nodeTypes: [...NODE_TYPES]
  }
}
