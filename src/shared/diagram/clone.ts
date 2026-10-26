import type { LinkData, NodeData, ViaType } from './types'

export interface CloneNodePlan {
  /** Block the copy is made from. */
  sourceId: number
  key: string
  code: string
  data: Omit<NodeData, 'id' | 'key' | 'code'>
}

export interface CloneLinkPlan {
  key: string
  fromKey: string
  toKey: string
  via: ViaType
  label: string
  note: string
}

export interface ClonePlan {
  nodes: CloneNodePlan[]
  links: CloneLinkPlan[]
}

/** First `<base>-copy`, `<base>-copy2`, `<base>-copy3`... that is not taken. Adds to `taken`. */
export function copyKey(base: string, taken: Set<string>): string {
  let key = `${base}-copy`
  let n = 2
  while (taken.has(key)) key = `${base}-copy${n++}`
  taken.add(key)
  return key
}

export interface CloneInput {
  nodes: readonly NodeData[]
  links: readonly LinkData[]
  /** Blocks to copy. */
  ids: readonly number[]
  takenNodeKeys: Iterable<string>
  takenLinkKeys: Iterable<string>
  offset: { x: number; y: number }
}

/**
 * Plans a copy of some blocks (FR-SUA-04). Channels are kept only when both ends are in the copied
 * set. Every copy gets a new key and code with the suffix "-copy". Images and pins are not copied.
 */
export function planClone(input: CloneInput): ClonePlan {
  const wanted = new Set(input.ids)
  const sources = input.nodes.filter((n) => wanted.has(n.id))
  const takenNodes = new Set(input.takenNodeKeys)
  const takenLinks = new Set(input.takenLinkKeys)
  const keyOf = new Map<number, string>()
  const nodes: CloneNodePlan[] = sources.map((n) => {
    const key = copyKey(n.key, takenNodes)
    keyOf.set(n.id, key)
    const { id: _id, key: _key, code, ...rest } = n
    void _id
    void _key
    return {
      sourceId: n.id,
      key,
      code: `${code}-copy`,
      data: {
        ...rest,
        chips: [...rest.chips],
        x: n.x + input.offset.x,
        y: n.y + input.offset.y,
        hasLayout: true
      }
    }
  })
  const links: CloneLinkPlan[] = []
  for (const l of input.links) {
    const fromKey = keyOf.get(l.fromNode)
    const toKey = keyOf.get(l.toNode)
    if (fromKey === undefined || toKey === undefined) continue
    links.push({
      key: copyKey(l.key, takenLinks),
      fromKey,
      toKey,
      via: l.via,
      label: l.label,
      note: l.note
    })
  }
  return { nodes, links }
}
