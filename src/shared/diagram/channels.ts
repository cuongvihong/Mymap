import type { LinkData, NodeType, ViaType } from './types'

/** Channels between one pair of blocks, in either direction (FR-LK-04, TDD 8.3). */
export interface PairGroup<L> {
  /** Stable key, the two end keys in sorted order joined by `|`. */
  key: string
  /** The two ends in sorted order. */
  a: string
  b: string
  links: L[]
}

export interface PairLink {
  id: number
  fromNode: number
  toNode: number
  sortOrder: number
}

/**
 * Group channels by the unordered pair of their ends. `endKey` maps a block to the key of what is
 * drawn at that end, so a block inside a collapsed group can map to the tile. Channels whose two ends
 * map to the same key are dropped. Pairs follow the order of their first channel; channels inside a
 * pair are ordered by sort_order then id, so the offsets of the wires never change by themselves.
 */
export function groupByPair<L extends PairLink>(
  links: readonly L[],
  endKey: (nodeId: number) => string = (id) => String(id)
): PairGroup<L>[] {
  const ordered = [...links].sort((x, y) => x.sortOrder - y.sortOrder || x.id - y.id)
  const groups = new Map<string, PairGroup<L>>()
  for (const l of ordered) {
    const from = endKey(l.fromNode)
    const to = endKey(l.toNode)
    if (from === to) continue
    const [a, b] = from < to ? [from, to] : [to, from]
    const key = `${a}|${b}`
    const group = groups.get(key) ?? { key, a, b, links: [] }
    group.links.push(l)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** The distinct via kinds of a list of channels, in order of first appearance. */
export function viaSet(links: readonly Pick<LinkData, 'via'>[]): ViaType[] {
  return [...new Set(links.map((l) => l.via))]
}

export interface TypedEnd {
  type: NodeType
  subtype: string | null
}

/**
 * Via filled in when a channel is created by dragging (FR-LK-02). Combinations the table does not
 * cover fall back to an internal call. Tech blocks of other kinds follow their meaning.
 */
export function defaultVia(from: TypedEnd, to: TypedEnd): ViaType {
  if (from.type === 'req') return 'impl'
  if (from.type === 'start') return from.subtype === 'schedule' ? 'job' : 'ui'
  if (from.type === 'fnc') {
    if (to.type === 'fnc') return 'call'
    if (to.type === 'end') return 'ui'
    if (to.type === 'ext') return 'rest'
    if (to.type === 'tech') {
      switch (to.subtype) {
        case 'database':
          return 'db'
        case 'api':
          return 'rest'
        case 'ui':
          return 'ui'
        case 'queue':
          return 'queue'
        case 'storage':
          return 'file'
        case 'job':
          return 'job'
        default:
          return 'call'
      }
    }
  }
  return 'call'
}

/**
 * Requirement coverage (FR-KH-08): for each REQ block, how many distinct Function blocks it reaches
 * through an `impl` channel.
 */
export function reqCoverage(
  nodes: readonly { id: number; type: NodeType }[],
  links: readonly Pick<LinkData, 'fromNode' | 'toNode' | 'via'>[]
): Map<number, number> {
  const type = new Map(nodes.map((n) => [n.id, n.type]))
  const reached = new Map<number, Set<number>>()
  for (const n of nodes) if (n.type === 'req') reached.set(n.id, new Set())
  for (const l of links) {
    if (l.via !== 'impl') continue
    if (type.get(l.toNode) !== 'fnc') continue
    reached.get(l.fromNode)?.add(l.toNode)
  }
  return new Map([...reached].map(([id, set]) => [id, set.size]))
}

/** Ids of the REQ blocks with no Function behind them. */
export function uncoveredReqs(coverage: ReadonlyMap<number, number>): Set<number> {
  return new Set([...coverage].filter(([, n]) => n === 0).map(([id]) => id))
}
