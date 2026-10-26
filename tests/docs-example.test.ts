import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFlowmap, validateFlowmap } from '../src/shared/diagram/flowmap'

describe('DINH-DANG-FLOWMAP.md', () => {
  it('the first example is valid Flowmap YAML with 4 blocks, 3 links, 1 scenario', () => {
    const md = readFileSync(join(__dirname, '../DINH-DANG-FLOWMAP.md'), 'utf8')
    const match = /```yaml\n([\s\S]*?)```/.exec(md)
    expect(match).not.toBeNull()
    const parsed = parseFlowmap(match?.[1] ?? '')
    const issues = validateFlowmap(parsed)
    expect(issues).toEqual([])
    const raw = parsed.raw as { nodes: unknown[]; links: unknown[]; scenarios: unknown[] }
    expect(raw.nodes).toHaveLength(4)
    expect(raw.links).toHaveLength(3)
    expect(raw.scenarios).toHaveLength(1)
  })
})
