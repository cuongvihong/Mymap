import type { Database } from 'better-sqlite3'
import type { ScenarioData, ScenarioType, StepData } from '../../../shared/diagram/types'

interface Row {
  id: number
  project_id: number
  key: string
  type: ScenarioType
  title: string
  parent_id: number | null
  fork_node_id: number | null
  sort_order: number
}

interface StepRow {
  id: number
  scenario_id: number
  idx: number
  node_id: number
  note: string
}

export interface ScenarioRecord extends ScenarioData {
  projectId: number
}

const toData = (r: Row): ScenarioData => ({
  id: r.id,
  key: r.key,
  type: r.type,
  title: r.title,
  parentId: r.parent_id,
  forkNodeId: r.fork_node_id,
  sortOrder: r.sort_order
})

const toStep = (r: StepRow): StepData => ({
  id: r.id,
  scenarioId: r.scenario_id,
  idx: r.idx,
  nodeId: r.node_id,
  note: r.note
})

export function listScenarios(db: Database, projectId: number): ScenarioData[] {
  const rows = db
    .prepare('SELECT * FROM dg_scenarios WHERE project_id = ? ORDER BY sort_order, id')
    .all(projectId) as Row[]
  return rows.map(toData)
}

export function getScenario(db: Database, id: number): ScenarioRecord | null {
  const row = db.prepare('SELECT * FROM dg_scenarios WHERE id = ?').get(id) as Row | undefined
  return row ? { ...toData(row), projectId: row.project_id } : null
}

export function listSteps(db: Database, projectId: number): StepData[] {
  const rows = db
    .prepare(
      `SELECT st.* FROM dg_steps st JOIN dg_scenarios s ON s.id = st.scenario_id
       WHERE s.project_id = ? ORDER BY st.scenario_id, st.idx`
    )
    .all(projectId) as StepRow[]
  return rows.map(toStep)
}

export function stepsOf(db: Database, scenarioId: number): StepData[] {
  const rows = db
    .prepare('SELECT * FROM dg_steps WHERE scenario_id = ? ORDER BY idx')
    .all(scenarioId) as StepRow[]
  return rows.map(toStep)
}

export function scenarioKeys(db: Database, projectId: number): string[] {
  return (
    db.prepare('SELECT key FROM dg_scenarios WHERE project_id = ?').all(projectId) as {
      key: string
    }[]
  ).map((r) => r.key)
}

export function keyToId(db: Database, projectId: number): Map<string, number> {
  const rows = db
    .prepare('SELECT id, key FROM dg_scenarios WHERE project_id = ?')
    .all(projectId) as {
    id: number
    key: string
  }[]
  return new Map(rows.map((r) => [r.key, r.id]))
}

export function nextSortOrder(db: Database, projectId: number): number {
  const row = db
    .prepare('SELECT MAX(sort_order) AS m FROM dg_scenarios WHERE project_id = ?')
    .get(projectId) as { m: number | null }
  return (row.m ?? -1) + 1
}

export function insertScenario(
  db: Database,
  s: {
    /** Given when a deleted scenario is put back under its old id (undo). */
    id?: number
    projectId: number
    key: string
    type: ScenarioType
    title: string
    parentId: number | null
    forkNodeId: number | null
    sortOrder: number
  }
): number {
  const info =
    s.id === undefined
      ? db
          .prepare(
            `INSERT INTO dg_scenarios (project_id, key, type, title, parent_id, fork_node_id, sort_order)
             VALUES (@projectId, @key, @type, @title, @parentId, @forkNodeId, @sortOrder)`
          )
          .run(s)
      : db
          .prepare(
            `INSERT INTO dg_scenarios (id, project_id, key, type, title, parent_id, fork_node_id, sort_order)
             VALUES (@id, @projectId, @key, @type, @title, @parentId, @forkNodeId, @sortOrder)`
          )
          .run(s)
  return Number(info.lastInsertRowid)
}

export function updateScenario(
  db: Database,
  id: number,
  s: {
    type: ScenarioType
    title: string
    parentId: number | null
    forkNodeId: number | null
    sortOrder: number
  }
): void {
  db.prepare(
    `UPDATE dg_scenarios SET type = ?, title = ?, parent_id = ?, fork_node_id = ?, sort_order = ?
     WHERE id = ?`
  ).run(s.type, s.title, s.parentId, s.forkNodeId, s.sortOrder, id)
}

export function setParent(
  db: Database,
  id: number,
  parentId: number | null,
  forkNodeId: number | null
): void {
  db.prepare('UPDATE dg_scenarios SET parent_id = ?, fork_node_id = ? WHERE id = ?').run(
    parentId,
    forkNodeId,
    id
  )
}

/** Branches that forked at one of the blocks become root scenarios. Returns their ids. */
export function detachForksAt(db: Database, nodeIds: readonly number[]): number[] {
  const ids: number[] = []
  const find = db.prepare('SELECT id FROM dg_scenarios WHERE fork_node_id = ?')
  for (const nodeId of nodeIds) {
    for (const r of find.all(nodeId) as { id: number }[]) ids.push(r.id)
  }
  const stmt = db.prepare(
    'UPDATE dg_scenarios SET parent_id = NULL, fork_node_id = NULL WHERE fork_node_id = ?'
  )
  for (const nodeId of nodeIds) stmt.run(nodeId)
  return ids
}

export function deleteScenarios(db: Database, ids: readonly number[]): void {
  const stmt = db.prepare('DELETE FROM dg_scenarios WHERE id = ?')
  for (const id of ids) stmt.run(id)
}

/** Scenarios that own a step on any of the blocks. */
export function scenarioIdsWithSteps(db: Database, nodeIds: readonly number[]): number[] {
  const out = new Set<number>()
  const stmt = db.prepare('SELECT DISTINCT scenario_id FROM dg_steps WHERE node_id = ?')
  for (const nodeId of nodeIds) {
    for (const r of stmt.all(nodeId) as { scenario_id: number }[]) out.add(r.scenario_id)
  }
  return [...out]
}

/** Replaces all steps of a scenario with idx 0..n-1. */
export function replaceSteps(
  db: Database,
  scenarioId: number,
  steps: readonly { nodeId: number; note: string }[]
): void {
  db.prepare('DELETE FROM dg_steps WHERE scenario_id = ?').run(scenarioId)
  const insert = db.prepare(
    'INSERT INTO dg_steps (scenario_id, idx, node_id, note) VALUES (?, ?, ?, ?)'
  )
  steps.forEach((s, i) => insert.run(scenarioId, i, s.nodeId, s.note))
}

/**
 * Closes gaps in idx after steps were deleted. Rows are visited in ascending order and moved
 * to a lower or equal idx, so the UNIQUE (scenario_id, idx) constraint is never hit.
 */
export function renumberSteps(db: Database, scenarioId: number): void {
  const rows = db
    .prepare('SELECT id, idx FROM dg_steps WHERE scenario_id = ? ORDER BY idx')
    .all(scenarioId) as { id: number; idx: number }[]
  const update = db.prepare('UPDATE dg_steps SET idx = ? WHERE id = ?')
  rows.forEach((r, i) => {
    if (r.idx !== i) update.run(i, r.id)
  })
}
