import type { Database } from 'better-sqlite3'
import type { GroupData, GroupFrame } from '../../../shared/diagram/types'

interface Row {
  id: number
  project_id: number
  key: string
  title: string
  fs_file: string | null
  collapsed: number
  sort_order: number
  frame_x: number | null
  frame_y: number | null
  frame_w: number | null
  frame_h: number | null
}

const toData = (r: Row): GroupData => ({
  id: r.id,
  key: r.key,
  title: r.title,
  fsFile: r.fs_file,
  collapsed: r.collapsed === 1,
  sortOrder: r.sort_order,
  frame:
    r.frame_x !== null && r.frame_y !== null && r.frame_w !== null && r.frame_h !== null
      ? { x: r.frame_x, y: r.frame_y, w: r.frame_w, h: r.frame_h }
      : null
})

export interface GroupRecord extends GroupData {
  projectId: number
}

export function listGroups(db: Database, projectId: number): GroupData[] {
  const rows = db
    .prepare('SELECT * FROM dg_groups WHERE project_id = ? ORDER BY sort_order, id')
    .all(projectId) as Row[]
  return rows.map(toData)
}

export function getGroup(db: Database, id: number): GroupRecord | null {
  const row = db.prepare('SELECT * FROM dg_groups WHERE id = ?').get(id) as Row | undefined
  return row ? { ...toData(row), projectId: row.project_id } : null
}

export function groupKeys(db: Database, projectId: number): string[] {
  return (
    db.prepare('SELECT key FROM dg_groups WHERE project_id = ?').all(projectId) as { key: string }[]
  ).map((r) => r.key)
}

export function keyToId(db: Database, projectId: number): Map<string, number> {
  const rows = db.prepare('SELECT id, key FROM dg_groups WHERE project_id = ?').all(projectId) as {
    id: number
    key: string
  }[]
  return new Map(rows.map((r) => [r.key, r.id]))
}

export function nextSortOrder(db: Database, projectId: number): number {
  const row = db
    .prepare('SELECT MAX(sort_order) AS m FROM dg_groups WHERE project_id = ?')
    .get(projectId) as { m: number | null }
  return (row.m ?? -1) + 1
}

export function insertGroup(
  db: Database,
  g: {
    id?: number
    projectId: number
    key: string
    title: string
    fsFile: string | null
    sortOrder: number
    collapsed?: boolean
    frame?: GroupFrame | null
  }
): number {
  const info = db
    .prepare(
      `INSERT INTO dg_groups (id, project_id, key, title, fs_file, collapsed, sort_order,
         frame_x, frame_y, frame_w, frame_h)
       VALUES (@id, @projectId, @key, @title, @fsFile, @collapsed, @sortOrder,
         @fx, @fy, @fw, @fh)`
    )
    .run({
      id: g.id ?? null,
      projectId: g.projectId,
      key: g.key,
      title: g.title,
      fsFile: g.fsFile,
      collapsed: g.collapsed ? 1 : 0,
      sortOrder: g.sortOrder,
      fx: g.frame?.x ?? null,
      fy: g.frame?.y ?? null,
      fw: g.frame?.w ?? null,
      fh: g.frame?.h ?? null
    })
  return Number(info.lastInsertRowid)
}

export function updateGroup(
  db: Database,
  id: number,
  g: {
    title: string
    fsFile: string | null
    collapsed: boolean
    sortOrder: number
    frame: GroupFrame | null
  }
): void {
  db.prepare(
    `UPDATE dg_groups SET title = ?, fs_file = ?, collapsed = ?, sort_order = ?,
       frame_x = ?, frame_y = ?, frame_w = ?, frame_h = ? WHERE id = ?`
  ).run(
    g.title,
    g.fsFile,
    g.collapsed ? 1 : 0,
    g.sortOrder,
    g.frame?.x ?? null,
    g.frame?.y ?? null,
    g.frame?.w ?? null,
    g.frame?.h ?? null,
    id
  )
}

export function deleteGroup(db: Database, id: number): void {
  db.prepare('DELETE FROM dg_groups WHERE id = ?').run(id)
}
