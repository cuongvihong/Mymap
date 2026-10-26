import { dataScenarios } from '../../../../shared/diagram/flowmap/convert'
import { connect, type Rect } from '../../../../shared/diagram/geometry'
import { draftPath, type Draft } from '../../../../shared/diagram/recorder'
import { fullPath } from '../../../../shared/diagram/scenario'
import { lineOffset, pathSegments } from '../../../../shared/diagram/scenarioView'
import type { ProjectData, ScenarioType } from '../../../../shared/diagram/types'

/** The path of one scenario as SVG path data, one entry per hop between two blocks (FR-KB-04). */
export interface ScenarioLine {
  key: string
  type: ScenarioType
  /** Path data of each hop. */
  hops: string[]
}

export interface LinesInput {
  data: ProjectData
  rects: ReadonlyMap<number, Rect>
  /** Scenarios drawn together, each lane 7 px from the next (FR-KB-05). */
  scenarioIds: readonly number[]
  /** The scenario being recorded: its path is drawn as it grows. */
  draft?: Draft | null
}

function hopsOf(
  path: readonly { nodeId: number | string }[],
  rects: ReadonlyMap<number, Rect>,
  offset: number
): string[] {
  const out: string[] = []
  for (const [a, b] of pathSegments(path)) {
    const ra = rects.get(a as number)
    const rb = rects.get(b as number)
    // Two blocks inside the same collapsed group share one tile: nothing to draw.
    if (!ra || !rb || ra === rb) continue
    out.push(connect(ra, rb, offset).d)
  }
  return out
}

/** Lines of the selected or playing scenarios, and of the draft while one is being recorded. */
export function buildScenarioLines(input: LinesInput): ScenarioLine[] {
  const { data, rects, scenarioIds, draft } = input
  const tree = dataScenarios(data)
  const lines: ScenarioLine[] = []
  const count = scenarioIds.length
  scenarioIds.forEach((id, index) => {
    const sc = data.scenarios.find((s) => s.id === id)
    if (!sc) return
    lines.push({
      key: sc.key,
      type: sc.type,
      hops: hopsOf(fullPath(tree, id), rects, lineOffset(index, count))
    })
  })
  if (draft && draft.steps.length > 0) {
    lines.push({ key: 'draft', type: draft.type, hops: hopsOf(draftPath(tree, draft), rects, 0) })
  }
  return lines
}
