import { describe, expect, it } from 'vitest'
import { createDiagramApi } from '../src/shared/diagram/ipcClient'
import { DIAGRAM_CHANNELS } from '../src/shared/diagram/types'

describe('createDiagramApi', () => {
  it('uses every declared channel exactly through the injected invoke', async () => {
    const seen = new Set<string>()
    const api = createDiagramApi(
      (channel) => {
        seen.add(channel)
        return Promise.resolve({ ok: true, data: null })
      },
      () => 'x'
    )
    for (const group of Object.values(api)) {
      if (typeof group !== 'object') continue
      for (const fn of Object.values(group as Record<string, (...a: unknown[]) => unknown>)) {
        await fn(1, 2, 3)
      }
    }
    const declared = Object.values(DIAGRAM_CHANNELS).flatMap((g) => Object.values(g))
    const strings: string[] = declared.filter((c) => typeof c === 'string')
    expect([...seen].sort()).toEqual(strings.sort())
    expect(api.pathOfFile({} as File)).toBe('x')
  })
})
