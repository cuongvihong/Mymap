import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(__dirname, '../src/renderer/features/diagram/styles/dg-tokens.css'),
  'utf8'
)

function block(selectorPattern: RegExp): Record<string, string> {
  const match = selectorPattern.exec(css)
  if (!match?.[1]) throw new Error(`block not found: ${selectorPattern}`)
  const vars: Record<string, string> = {}
  for (const m of match[1].matchAll(/(--dg-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    vars[m[1] as string] = (m[2] as string).toLowerCase()
  }
  return vars
}

const dark = block(/\.dg-root\s*\{([^}]*)\}/)
const light = { ...dark, ...block(/\.dg-root\[data-theme=['"]light['"]\]\s*\{([^}]*)\}/) }

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// NFR-07: text contrast at least 4.5:1 in both themes.
const TEXT = ['--dg-ink', '--dg-ink-2', '--dg-muted', '--dg-accent-ink']
const SURFACES = ['--dg-panel', '--dg-panel-2', '--dg-canvas', '--dg-bg']

describe.each([
  ['dark', dark],
  ['light', light]
])('text contrast in the %s theme (NFR-07)', (_name, theme) => {
  for (const fg of TEXT) {
    for (const bg of SURFACES) {
      it(`${fg} on ${bg} is at least 4.5:1`, () => {
        const fgColor = theme[fg]
        const bgColor = theme[bg]
        expect(fgColor, `${fg} missing`).toBeDefined()
        expect(bgColor, `${bg} missing`).toBeDefined()
        expect(contrast(fgColor as string, bgColor as string)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('token file', () => {
  it('declares the full TDD 9.2 variable set', () => {
    const required = [
      '--dg-canvas',
      '--dg-dot',
      '--dg-panel',
      '--dg-panel-2',
      '--dg-line',
      '--dg-ink',
      '--dg-ink-2',
      '--dg-muted',
      '--dg-edge',
      '--dg-edge-hi',
      '--dg-accent',
      '--dg-t-fnc',
      '--dg-t-req',
      '--dg-t-tech',
      '--dg-t-ext',
      '--dg-t-start',
      '--dg-t-ok',
      '--dg-t-fail',
      '--dg-t-warn',
      '--dg-t-cond',
      '--dg-t-note',
      '--dg-v-impl',
      '--dg-v-rest',
      '--dg-v-webhook',
      '--dg-v-db',
      '--dg-v-ui',
      '--dg-v-call',
      '--dg-v-redirect',
      '--dg-v-job',
      '--dg-v-event',
      '--dg-v-queue',
      '--dg-v-file',
      '--dg-s-pos',
      '--dg-s-neg',
      '--dg-s-alt',
      '--dg-s-edge'
    ]
    for (const name of required) expect(dark[name], name).toBeDefined()
    expect(css).toContain('--dg-dim: 0.22')
    expect(css).toContain('--dg-dim-edge: 0.16')
  })

  it('overrides only the theme colours in the light block', () => {
    const lightOnly = block(/\.dg-root\[data-theme=['"]light['"]\]\s*\{([^}]*)\}/)
    for (const name of Object.keys(lightOnly)) {
      expect(name).not.toMatch(/^--dg-(t|v|s)-/)
    }
  })
})

// Session 09: the colours the YAML panel and the import dialog use for text.
const YAML_TEXT = [
  '--dg-focus',
  '--dg-tx-ok',
  '--dg-tx-warn',
  '--dg-tx-fail',
  '--dg-accent-ink',
  '--dg-edge-hi'
]
describe.each([
  ['dark', dark],
  ['light', light]
])('YAML panel and dialog text in the %s theme (NFR-07)', (_name, theme) => {
  for (const fg of YAML_TEXT) {
    for (const bg of ['--dg-bg', '--dg-panel', '--dg-panel-2']) {
      it(`${fg} on ${bg} is at least 4.5:1`, () => {
        const c = contrast(theme[fg] as string, theme[bg] as string)
        expect(c).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
