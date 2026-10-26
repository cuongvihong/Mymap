import { idProblem } from '../../../shared/diagram/ids'
import { DiagramError } from '../errors'

/** A required id argument: an integer. */
export function intArg(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DiagramError('INVALID_ARGUMENT', `${name} must be an integer`)
  }
  return value
}

export function intList(value: unknown, name: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DiagramError('INVALID_ARGUMENT', `${name} must be a non empty list`)
  }
  const out = value.map((v) => intArg(v, name))
  return [...new Set(out)]
}

export function plainObject(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiagramError('INVALID_ARGUMENT', `${name} must be an object`)
  }
  return value as Record<string, unknown>
}

const len = (s: string) => [...s].length

/** Text field: a string within the limit. Required fields reject blank text. Returns the trimmed text. */
export function text(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string') {
    throw new DiagramError('INVALID_ARGUMENT', `${field} must be a string`)
  }
  const out = value.trim()
  if (required && out === '') throw new DiagramError('FIELD_REQUIRED', `${field} is required`)
  if (len(out) > max) throw new DiagramError('FIELD_TOO_LONG', `${field} is longer than ${max}`)
  return out
}

/** Free text such as a body: only the limit is checked, inner spacing is kept. */
export function freeText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') {
    throw new DiagramError('INVALID_ARGUMENT', `${field} must be a string`)
  }
  if (len(value) > max) throw new DiagramError('FIELD_TOO_LONG', `${field} is longer than ${max}`)
  return value
}

export function nullableText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null
  const out = text(value, field, max)
  return out === '' ? null : out
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new DiagramError('ENUM_INVALID', `${field} is not one of ${allowed.join(', ')}`)
  }
  return value as T
}

export function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DiagramError('INVALID_ARGUMENT', `${field} must be a finite number`)
  }
  return value
}

/** A key given by the caller: BR-01 format and unique in its table. */
export function key(value: unknown, taken: ReadonlySet<string>): string {
  const problem = idProblem(value)
  if (problem) throw new DiagramError('KEY_INVALID', problem)
  if (taken.has(value as string)) {
    throw new DiagramError('KEY_DUPLICATE', `Key ${String(value)} is already used in this project`)
  }
  return value as string
}
