export type Id = string | number

/** The two ends of a channel. Both ChannelData-like objects and Flowmap links fit. */
export interface LinkEnds {
  id: Id
  from: Id
  to: Id
}

/** The block and every block that has a channel with it, in either direction. */
export function neighbors(links: readonly LinkEnds[], id: Id): Set<Id> {
  const out = new Set<Id>([id])
  for (const l of links) {
    if (l.from === id) out.add(l.to)
    if (l.to === id) out.add(l.from)
  }
  return out
}

/** Ids of the channels that touch the block. */
export function incidentLinks(links: readonly LinkEnds[], id: Id): Set<Id> {
  const out = new Set<Id>()
  for (const l of links) if (l.from === id || l.to === id) out.add(l.id)
  return out
}

export interface LitInput {
  links: readonly LinkEnds[]
  focusId: Id | null
  /** One list of block ids per selected scenario, each the full path of that scenario. */
  scenarioPaths: readonly (readonly Id[])[]
}

/**
 * Blocks that stay lit (FR-CV-07). null means nothing is dimmed.
 * Focus only: the neighbours. Scenarios only: the union of the paths.
 * Both: the intersection, or the neighbours alone when the intersection is empty.
 */
export function litNodes(input: LitInput): Set<Id> | null {
  const focus = input.focusId !== null ? neighbors(input.links, input.focusId) : null
  let paths: Set<Id> | null = null
  if (input.scenarioPaths.length > 0) {
    paths = new Set<Id>()
    for (const p of input.scenarioPaths) for (const n of p) paths.add(n)
  }
  if (focus && paths) {
    const both = new Set<Id>([...focus].filter((n) => paths.has(n)))
    return both.size > 0 ? both : focus
  }
  return focus ?? paths
}
