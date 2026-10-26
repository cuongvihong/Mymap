import { describe, expect, it } from 'vitest'
import { diagramStrings } from '../src/renderer/features/diagram/strings'
import { shellStrings } from '../src/renderer/shell/strings'
import { KHO_ERROR_CODES } from '../src/shared/api'
import {
  DIAGRAM_ERROR_CODES,
  NODE_TYPES,
  SCENARIO_TYPES,
  VIA_TYPES
} from '../src/shared/diagram/types'

function collect(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collect(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collect(v, out))
  return out
}

// BR-11 and MASTER 4.12: no dash used as punctuation in UI text.
const DASH_PUNCTUATION = /[\u2013\u2014]|(^|\s)-(\s|$)/

describe('UI strings (BR-11)', () => {
  it.each([
    ['diagram strings', diagramStrings],
    ['shell strings', shellStrings]
  ])('%s contain no dash used as punctuation', (_name, source) => {
    const bad = collect(source).filter((s) => DASH_PUNCTUATION.test(s))
    expect(bad).toEqual([])
  })

  it('every channel, block and scenario type has a Vietnamese label', () => {
    for (const via of VIA_TYPES) expect(diagramStrings.via[via]).toBeTruthy()
    for (const type of NODE_TYPES) expect(diagramStrings.nodeType[type]).toBeTruthy()
    for (const type of SCENARIO_TYPES) expect(diagramStrings.scenarioType[type]).toBeTruthy()
  })

  it('every error code has a Vietnamese message', () => {
    for (const code of [...DIAGRAM_ERROR_CODES, ...KHO_ERROR_CODES].filter(
      (c) => c !== 'CANCELLED'
    )) {
      expect(shellStrings.errors[code], code).toBeTruthy()
    }
  })
})
