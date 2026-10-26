import type { Database } from 'better-sqlite3'
import { normalize } from '../../../shared/diagram/normalize'
import type { NodeData, NodeType } from '../../../shared/diagram/types'

interface Row {
  id: number
  project_id: number
  key: string
  type: NodeType
  subtype: string | null
  code: string
  title: string
  body: string
  fix_text: string
  chips_json: string
  fs_file: string | null
  fs_section: string | null
  group_id: number | null
  x: number
  y: number
  has_layout: number
  collapsed: number
}

export interface NodeRecord extends NodeData {
  projectId: number
}

function parseChips(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const toData = (r: Row): NodeData => ({
  id: r.id,
  key: r.key,
  type: r.type,
  subtype: r.subtype,
  code: r.code,
  title: r.title,
  body: r.body,
  fixText: r.fix_text,
  chips: parseChips(r.chips_json),
  fsFile: r.fs_file,
  fsSection: r.fs_section,
  groupId: r.group_id,
  x: r.x,
  y: r.y,
  hasLayout: r.has_layout === 1,
  collapsed: r.collapsed === 1
})

/** Text that the sidebar search matches against (TDD 5.2). */
export function searchText(n: {
  code: string
  title: string
  body: string
  fixText: string
  chips: string[]
}): string {
  return normalize([n.code, n.title, n.body, n.fixText, n.chips.join(' ')].join(' '))
}

export function listNodes(db: Database, projectId: number): NodeData[] {
  const rows = db
    .prepare('SELECT * FROM dg_nodes WHERE project_id = ? ORDER BY id')
    .all(projectId) as Row[]
  return rows.map(toData)
}

export function getNode(db: Database, id: number): NodeRecord | null {
  const row = db.prepare('SELECT * FROM dg_nodes WHERE id = ?').get(id) as Row | undefined
  return row ? { ...toData(row), projectId: row.project_id } : null
}

export function getNodes(db: Database, ids: readonly number[]): NodeRecord[] {
  return ids.map((id) => getNode(db, id)).filter((n): n is NodeRecord => n !== null)
}

export function nodeKeys(db: Database, projectId: number): string[] {
  return (
    db.prepare('SELECT key FROM dg_nodes WHERE project_id = ?').all(projectId) as { key: string }[]
  ).map((r) => r.key)
}

export function keyToId(db: Database, projectId: number): Map<string, number> {
  const rows = db.prepare('SELECT id, key FROM dg_nodes WHERE project_id = ?').all(projectId) as {
    id: number
    key: string
  }[]
  return new Map(rows.map((r) => [r.key, r.id]))
}

/** Bounds of the blocks that have real coordinates, and how many blocks still wait for a layout. */
export function layoutState(
  db: Database,
  projectId: number
): { minX: number; maxY: number; placed: number; pending: number } {
  const row = db
    .prepare(
      `SELECT MIN(CASE WHEN has_layout = 1 THEN x END) AS min_x,
              MAX(CASE WHEN has_layout = 1 THEN y END) AS max_y,
              SUM(has_layout) AS placed,
              SUM(1 - has_layout) AS pending
       FROM dg_nodes WHERE project_id = ?`
    )
    .get(projectId) as {
    min_x: number | null
    max_y: number | null
    placed: number | null
    pending: number | null
  }
  return {
    minX: row.min_x ?? 0,
    maxY: row.max_y ?? 0,
    placed: row.placed ?? 0,
    pending: row.pending ?? 0
  }
}

export interface NodeWrite {
  key: string
  type: NodeType
  subtype: string | null
  code: string
  title: string
  body: string
  fixText: string
  chips: string[]
  fsFile: string | null
  fsSection: string | null
  groupId: number | null
  x: number
  y: number
  hasLayout: boolean
  collapsed: boolean
}

export function insertNode(
  db: Database,
  projectId: number,
  n: NodeWrite,
  now: string,
  id?: number
): number {
  const info = db
    .prepare(
      `INSERT INTO dg_nodes (id, project_id, key, type, subtype, code, title, body, fix_text, chips_json,
         fs_file, fs_section, group_id, x, y, has_layout, collapsed, search_norm, created_at, updated_at)
       VALUES (@id, @projectId, @key, @type, @subtype, @code, @title, @body, @fixText, @chips,
         @fsFile, @fsSection, @groupId, @x, @y, @hasLayout, @collapsed, @search, @now, @now)`
    )
    .run({
      id: id ?? null,
      projectId,
      key: n.key,
      type: n.type,
      subtype: n.subtype,
      code: n.code,
      title: n.title,
      body: n.body,
      fixText: n.fixText,
      chips: JSON.stringify(n.chips),
      fsFile: n.fsFile,
      fsSection: n.fsSection,
      groupId: n.groupId,
      x: n.x,
      y: n.y,
      hasLayout: n.hasLayout ? 1 : 0,
      collapsed: n.collapsed ? 1 : 0,
      search: searchText(n),
      now
    })
  return Number(info.lastInsertRowid)
}

export function updateNode(db: Database, id: number, n: NodeWrite, now: string): void {
  db.prepare(
    `UPDATE dg_nodes SET type = @type, subtype = @subtype, code = @code, title = @title, body = @body,
       fix_text = @fixText, chips_json = @chips, fs_file = @fsFile, fs_section = @fsSection,
       group_id = @groupId, x = @x, y = @y, has_layout = @hasLayout, collapsed = @collapsed,
       search_norm = @search, updated_at = @now
     WHERE id = @id`
  ).run({
    id,
    type: n.type,
    subtype: n.subtype,
    code: n.code,
    title: n.title,
    body: n.body,
    fixText: n.fixText,
    chips: JSON.stringify(n.chips),
    fsFile: n.fsFile,
    fsSection: n.fsSection,
    groupId: n.groupId,
    x: n.x,
    y: n.y,
    hasLayout: n.hasLayout ? 1 : 0,
    collapsed: n.collapsed ? 1 : 0,
    search: searchText(n),
    now
  })
}

export function setPosition(db: Database, id: number, x: number, y: number): void {
  db.prepare('UPDATE dg_nodes SET x = ?, y = ?, has_layout = 1 WHERE id = ?').run(x, y, id)
}

export function setGroupOf(db: Database, id: number, groupId: number | null): void {
  db.prepare('UPDATE dg_nodes SET group_id = ? WHERE id = ?').run(groupId, id)
}

export function idsInGroup(db: Database, groupId: number): number[] {
  return (
    db.prepare('SELECT id FROM dg_nodes WHERE group_id = ? ORDER BY id').all(groupId) as {
      id: number
    }[]
  ).map((r) => r.id)
}

export function deleteNodes(db: Database, ids: readonly number[]): void {
  const stmt = db.prepare('DELETE FROM dg_nodes WHERE id = ?')
  for (const id of ids) stmt.run(id)
}
