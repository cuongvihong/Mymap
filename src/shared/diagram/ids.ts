import { LIMITS, type NodeType, type ScenarioType, type ViaType } from './types'

/** BR-01: ascii letters, digits and `. _ -` only. */
export const ID_PATTERN = /^[A-Za-z0-9._-]+$/

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= LIMITS.id && ID_PATTERN.test(id)
}

/** Why an id is not acceptable, or null when it is. Text is Vietnamese, ready for the UI. */
export function idProblem(id: unknown): string | null {
  if (typeof id !== 'string' || id.length === 0) return 'id không được để trống'
  if (id.length > LIMITS.id) return `id dài quá ${LIMITS.id} ký tự`
  if (!ID_PATTERN.test(id)) return 'id chỉ gồm chữ không dấu, số và các ký tự . _ -'
  return null
}

/** Prefix of the key given to a block that the user creates without naming it. */
export const NODE_KEY_PREFIX: Record<NodeType, string> = {
  fnc: 'F',
  req: 'REQ',
  tech: 'T',
  ext: 'X',
  start: 'S',
  end: 'E',
  cond: 'C',
  note: 'N'
}

/**
 * Next free id of the form `<prefix><n>`. n is one more than the highest number already used
 * with this prefix, so ids stay stable and deleted ids are not recycled straight away.
 */
export function newId(prefix: string, taken: Iterable<string>): string {
  let max = 0
  const used = new Set<string>()
  for (const id of taken) {
    used.add(id)
    if (id.startsWith(prefix)) {
      const rest = id.slice(prefix.length)
      if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest))
    }
  }
  let n = max + 1
  while (used.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/** Keeps only characters BR-01 allows. Used to turn a title into a key suggestion. */
export function sanitizeId(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.id)
}

/**
 * Key of a link. YAML links have no id, so it is derived from the ends and the kind. The first link
 * with a given (from, to, via) has the base key, the next ones get `_2`, `_3`.
 * `taken` is the set of keys already used in the project.
 */
export function deriveLinkKey(
  from: string,
  to: string,
  via: ViaType,
  taken: ReadonlySet<string>
): string {
  const base = `${from}_${to}_${via}`
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n++
  return `${base}_${n}`
}

const SCENARIO_PREFIX: Record<ScenarioType, string> = { pos: 'P', neg: 'N', alt: 'A', edge: 'E' }

/** Next scenario key such as `N-06`: the type letter, a hyphen, and a two digit number. */
export function newScenarioKey(type: ScenarioType, taken: Iterable<string>): string {
  const prefix = `${SCENARIO_PREFIX[type]}-`
  const used = new Set<string>(taken)
  let max = 0
  for (const id of used) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(id)
    if (m?.[1]) max = Math.max(max, Number(m[1]))
  }
  let n = max + 1
  while (used.has(`${prefix}${String(n).padStart(2, '0')}`)) n++
  return `${prefix}${String(n).padStart(2, '0')}`
}
