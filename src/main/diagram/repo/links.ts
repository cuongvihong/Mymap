import type { Database } from 'better-sqlite3'
import type { LinkData, ViaType } from '../../../shared/diagram/types'

interface Row {
  id: number
  project_id: number
  key: string
  from_node: number
  to_node: number
  via: ViaType
  label: string
  note: string
  sort_order: number
}

export interface LinkRecord extends LinkData {
  projectId: number
}

const toData = (r: Row): LinkData => ({
  id: r.id,
  key: r.key,
  fromNode: r.from_node,
  toNode: r.to_node,
  via: r.via,
  label: r.label,
  note: r.note,
  sortOrder: r.sort_order
})

export function listLinks(db: Database, projectId: number): LinkData[] {
  const rows = db
    .prepare('SELECT * FROM dg_links WHERE project_id = ? ORDER BY sort_order, id')
    .all(projectId) as Row[]
  return rows.map(toData)
}

export function getLink(db: Database, id: number): LinkRecord | null {
  const row = db.prepare('SELECT * FROM dg_links WHERE id = ?').get(id) as Row | undefined
  return row ? { ...toData(row), projectId: row.project_id } : null
}

export function linkKeys(db: Database, projectId: number): string[] {
  return (
    db.prepare('SELECT key FROM dg_links WHERE project_id = ?').all(projectId) as { key: string }[]
  ).map((r) => r.key)
}

export function keyToId(db: Database, projectId: number): Map<string, number> {
  const rows = db.prepare('SELECT id, key FROM dg_links WHERE project_id = ?').all(projectId) as {
    id: number
    key: string
  }[]
  return new Map(rows.map((r) => [r.key, r.id]))
}

export function nextSortOrder(db: Database, projectId: number): number {
  const row = db
    .prepare('SELECT MAX(sort_order) AS m FROM dg_links WHERE project_id = ?')
    .get(projectId) as { m: number | null }
  return (row.m ?? -1) + 1
}

export function insertLink(
  db: Database,
  l: {
    id?: number
    projectId: number
    key: string
    fromNode: number
    toNode: number
    via: ViaType
    label: string
    note: string
    sortOrder: number
  }
): number {
  const info = db
    .prepare(
      `INSERT INTO dg_links (id, project_id, key, from_node, to_node, via, label, note, sort_order)
       VALUES (@id, @projectId, @key, @fromNode, @toNode, @via, @label, @note, @sortOrder)`
    )
    .run({ ...l, id: l.id ?? null })
  return Number(info.lastInsertRowid)
}

export function updateLink(
  db: Database,
  id: number,
  l: { fromNode: number; toNode: number; via: ViaType; label: string; note: string }
): void {
  db.prepare(
    'UPDATE dg_links SET from_node = ?, to_node = ?, via = ?, label = ?, note = ? WHERE id = ?'
  ).run(l.fromNode, l.toNode, l.via, l.label, l.note, id)
}

export function deleteLinks(db: Database, ids: readonly number[]): void {
  const stmt = db.prepare('DELETE FROM dg_links WHERE id = ?')
  for (const id of ids) stmt.run(id)
}
