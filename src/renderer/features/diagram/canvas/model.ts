import { groupByPair, reqCoverage, uncoveredReqs } from '../../../../shared/diagram/channels'
import {
  blockDisplay,
  edgeDisplay,
  frameDisplay,
  type BlockDisplay,
  type DisplayState,
  type EdgeDisplay,
  type FrameDisplay
} from '../../../../shared/diagram/display'
import { dataLinkEnds, dataScenarios } from '../../../../shared/diagram/flowmap/convert'
import { litNodes } from '../../../../shared/diagram/focus'
import {
  blockWidth,
  DEFAULT_BLOCK_HEIGHT,
  frameBounds,
  TILE_SIZE
} from '../../../../shared/diagram/frames'
import {
  connect,
  parallelOffset,
  type Connection,
  type Rect
} from '../../../../shared/diagram/geometry'
import { pathNodeIds } from '../../../../shared/diagram/scenario'
import type { GroupData, LinkData, NodeData, ProjectData } from '../../../../shared/diagram/types'

export interface BlockModel {
  node: NodeData
  rect: Rect
  display: BlockDisplay
}

export interface FrameModel {
  group: GroupData
  /** The dashed frame, or the collapsed tile when the group is collapsed. */
  rect: Rect
  collapsed: boolean
  memberIds: number[]
  display: FrameDisplay
}

/** One channel drawn as a wire. */
export interface WireModel {
  link: LinkData
  conn: Connection
}

/** All channels between one pair of blocks (or tiles), in either direction (TDD 8.3). */
export interface PairModel {
  key: string
  links: LinkData[]
  /** The merged wire of the one-wire mode, in the direction of the first channel. */
  base: Connection
  /** One wire per channel, side by side, same order as `links`. */
  wires: WireModel[]
  /** Channels run both ways, so the merged wire gets an arrow at each end. */
  bothWays: boolean
  display: EdgeDisplay
  /** The two ends of the first channel. */
  fromId: number
  toId: number
}

export interface CanvasModel {
  /** Rectangle of every block as it is drawn. A block inside a collapsed group has the tile of the group. */
  rects: Map<number, Rect>
  /** Blocks that are drawn (not hidden inside a collapsed group). */
  blocks: BlockModel[]
  frames: FrameModel[]
  pairs: PairModel[]
  /** REQ block id to the number of Function blocks behind it. */
  coverage: Map<number, number>
  /** REQ blocks with nothing behind them. */
  uncovered: Set<number>
  display: DisplayState
}

export interface ModelInput {
  data: ProjectData
  sizes: Readonly<Record<number, { w: number; h: number }>>
  focusId: number | null
  selectedScenarios: readonly number[]
  /** The sidebar filter "REQ chưa phủ" (FR-KH-08). */
  filterUncovered?: boolean
  /** Blocks found by the "Nơi sửa" filter (FR-TIM-02). Null when the filter is off. */
  fixIds?: ReadonlySet<number> | null
}

/** Rectangle of a block in world coordinates. The height is the measured one when known. */
export function blockRect(
  node: NodeData,
  sizes: Readonly<Record<number, { w: number; h: number }>>
): Rect {
  const size = sizes[node.id]
  return {
    x: node.x,
    y: node.y,
    w: blockWidth(node.type),
    h: size?.h ?? DEFAULT_BLOCK_HEIGHT
  }
}

/**
 * Everything the canvas draws, as plain data: blocks with their display class, group frames (or
 * tiles) and the channels. Pure, so the lit/dim rules can be tested without React.
 */
export function buildCanvasModel(input: ModelInput): CanvasModel {
  const { data, sizes, focusId, selectedScenarios } = input
  const scenarios = dataScenarios(data)
  const lit = litNodes({
    links: dataLinkEnds(data),
    focusId,
    scenarioPaths: selectedScenarios.map((id) => pathNodeIds(scenarios, id) as number[])
  }) as Set<number> | null
  const coverage = reqCoverage(data.nodes, data.links)
  const uncovered = uncoveredReqs(coverage)
  let litFinal: Set<number> | null = lit
  if (input.filterUncovered) {
    litFinal = lit ? new Set([...lit].filter((id) => uncovered.has(id))) : new Set(uncovered)
  }
  if (input.fixIds) {
    litFinal = litFinal
      ? new Set([...litFinal].filter((id) => input.fixIds?.has(id)))
      : new Set(input.fixIds)
  }
  const display: DisplayState = { lit: litFinal, focusId }

  const rects = new Map<number, Rect>()
  for (const n of data.nodes) rects.set(n.id, blockRect(n, sizes))

  // Frames, and the tile that stands in for a collapsed group.
  const frames: FrameModel[] = []
  const hiddenBy = new Map<number, FrameModel>()
  for (const g of data.groups) {
    const members = data.nodes.filter((n) => n.groupId === g.id)
    // An empty group keeps the frame it was created with.
    const bounds =
      frameBounds(members.map((m) => rects.get(m.id) as Rect)) ??
      (g.frame ? { x: g.frame.x, y: g.frame.y, w: g.frame.w, h: g.frame.h } : null)
    if (!bounds) continue
    const memberIds = members.map((m) => m.id)
    const model: FrameModel = {
      group: g,
      collapsed: g.collapsed,
      memberIds,
      rect: g.collapsed ? { x: bounds.x, y: bounds.y, ...TILE_SIZE } : bounds,
      display: frameDisplay(memberIds, display)
    }
    frames.push(model)
    if (g.collapsed) for (const id of memberIds) hiddenBy.set(id, model)
  }

  const blocks: BlockModel[] = data.nodes
    .filter((n) => !hiddenBy.has(n.id))
    .map((n) => ({
      node: n,
      rect: rects.get(n.id) as Rect,
      display: blockDisplay(n.id, display)
    }))

  // Channels. An end inside a collapsed group attaches to the tile. Channels inside one tile vanish.
  const endKey = (id: number): string => {
    const tile = hiddenBy.get(id)
    return tile ? `g${tile.group.id}` : `n${id}`
  }
  const rectOf = (id: number): Rect => hiddenBy.get(id)?.rect ?? (rects.get(id) as Rect)
  const pairs: PairModel[] = groupByPair(data.links, endKey).map((group) => {
    const first = group.links[0] as LinkData
    const count = group.links.length
    const wires = group.links.map((link, index) => ({
      link,
      conn: connect(rectOf(link.fromNode), rectOf(link.toNode), parallelOffset(index, count))
    }))
    const bothWays = group.links.some((l) => endKey(l.fromNode) !== endKey(first.fromNode))
    return {
      key: group.key,
      links: group.links,
      base: connect(rectOf(first.fromNode), rectOf(first.toNode), 0),
      wires,
      bothWays,
      display: edgeDisplay({ from: first.fromNode, to: first.toNode }, display),
      fromId: first.fromNode,
      toId: first.toNode
    }
  })
  const drawn = new Map<number, Rect>()
  for (const n of data.nodes) drawn.set(n.id, rectOf(n.id))
  return { rects: drawn, blocks, frames, pairs, coverage, uncovered, display }
}
