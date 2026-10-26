import { normalize } from './normalize'

export interface SearchableNode {
  id: number
  key: string
  code: string
  title: string
  body: string
  fixText: string
  chips: readonly string[]
}

export interface SearchHit {
  id: number
  /** 0 when the code or key matches, 1 for the title, 2 for anything else. Lower is better. */
  rank: number
}

const tokensOf = (query: string): string[] => normalize(query).split(' ').filter(Boolean)

/** Text the search looks at (FR-TIM-01): code, key, title, body, "Nơi sửa" and chips. */
export function searchText(n: SearchableNode): string {
  return normalize([n.code, n.key, n.title, n.body, n.fixText, n.chips.join(' ')].join(' '))
}

/**
 * Accent and case insensitive search. Every word of the query must appear somewhere. Matches on
 * the code or key come first, then the title, then the rest, each group in the order of `nodes`.
 */
export function searchNodes(
  nodes: readonly SearchableNode[],
  query: string,
  limit = 30
): SearchHit[] {
  const tokens = tokensOf(query)
  if (tokens.length === 0) return []
  const hits: SearchHit[] = []
  for (const n of nodes) {
    const all = searchText(n)
    if (!tokens.every((t) => all.includes(t))) continue
    const head = normalize(`${n.code} ${n.key}`)
    const title = normalize(n.title)
    const rank = tokens.every((t) => head.includes(t))
      ? 0
      : tokens.every((t) => title.includes(t))
        ? 1
        : 2
    hits.push({ id: n.id, rank })
  }
  return hits
    .map((h, i) => ({ h, i }))
    .sort((a, b) => a.h.rank - b.h.rank || a.i - b.i)
    .map((x) => x.h)
    .slice(0, limit)
}

/** Blocks whose "Nơi sửa" contains the phrase (FR-TIM-02). An empty phrase matches nothing. */
export function fixMatches(
  nodes: readonly Pick<SearchableNode, 'id' | 'fixText'>[],
  phrase: string
): Set<number> {
  const needle = normalize(phrase)
  const out = new Set<number>()
  if (needle === '') return out
  for (const n of nodes) if (normalize(n.fixText).includes(needle)) out.add(n.id)
  return out
}
