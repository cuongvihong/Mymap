import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFlowmap } from '../../src/shared/diagram/flowmap'
import type { FlowmapDoc } from '../../src/shared/diagram/types'

export const SAMPLE_PATH = join(__dirname, '..', 'fixtures', 'moe-ea.flowmap.yaml')

export function sampleText(): string {
  return readFileSync(SAMPLE_PATH, 'utf8')
}

/** The sample file as a document. Fails the test when the sample has an error. */
export function sampleDoc(): FlowmapDoc {
  const { doc, issues } = readFlowmap(sampleText())
  if (!doc) throw new Error(`sample has errors: ${issues.map((i) => i.message).join('; ')}`)
  return doc
}

export const emptyDoc = (): FlowmapDoc => ({
  project: { name: null, docsRoot: null },
  groups: [],
  nodes: [],
  links: [],
  scenarios: [],
  layout: {}
})
