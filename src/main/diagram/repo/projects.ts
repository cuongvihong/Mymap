import type { Database } from 'better-sqlite3'
import type { ProjectInfo, ProjectSummary } from '../../../shared/diagram/types'

interface ProjectRow {
  id: number
  code: number
  name: string
  folder: string
  docs_root: string | null
  viewport_json: string | null
  settings_json: string
  created_at: string
  updated_at: string
}

export interface ProjectRecord extends ProjectInfo {
  viewportJson: string | null
  settingsJson: string
}

const toRecord = (r: ProjectRow): ProjectRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  folder: r.folder,
  docsRoot: r.docs_root,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  viewportJson: r.viewport_json,
  settingsJson: r.settings_json
})

export const toInfo = (r: ProjectRecord): ProjectInfo => ({
  id: r.id,
  code: r.code,
  name: r.name,
  folder: r.folder,
  docsRoot: r.docsRoot,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt
})

export function listProjects(db: Database): ProjectSummary[] {
  const rows = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM dg_nodes n WHERE n.project_id = p.id) AS node_count
       FROM dg_projects p ORDER BY p.updated_at DESC, p.id DESC`
    )
    .all() as (ProjectRow & { node_count: number })[]
  return rows.map((r) => ({ ...toInfo(toRecord(r)), nodeCount: r.node_count }))
}

export function getProject(db: Database, id: number): ProjectRecord | null {
  const row = db.prepare('SELECT * FROM dg_projects WHERE id = ?').get(id) as ProjectRow | undefined
  return row ? toRecord(row) : null
}

export function findIdByNameNorm(db: Database, nameNorm: string): number | null {
  const row = db.prepare('SELECT id FROM dg_projects WHERE name_norm = ?').get(nameNorm) as
    { id: number } | undefined
  return row?.id ?? null
}

export function maxCode(db: Database): number {
  const row = db.prepare('SELECT MAX(code) AS m FROM dg_projects').get() as { m: number | null }
  return row.m ?? 0
}

export function insertProject(
  db: Database,
  p: { code: number; name: string; nameNorm: string; folder: string; now: string }
): number {
  const info = db
    .prepare(
      `INSERT INTO dg_projects (code, name, name_norm, folder, created_at, updated_at)
       VALUES (@code, @name, @nameNorm, @folder, @now, @now)`
    )
    .run(p)
  return Number(info.lastInsertRowid)
}

export function updateName(db: Database, id: number, name: string, nameNorm: string, now: string) {
  db.prepare('UPDATE dg_projects SET name = ?, name_norm = ?, updated_at = ? WHERE id = ?').run(
    name,
    nameNorm,
    now,
    id
  )
}

export function updateDocsRoot(db: Database, id: number, docsRoot: string | null, now: string) {
  db.prepare('UPDATE dg_projects SET docs_root = ?, updated_at = ? WHERE id = ?').run(
    docsRoot,
    now,
    id
  )
}

export function updateViewport(db: Database, id: number, json: string) {
  db.prepare('UPDATE dg_projects SET viewport_json = ? WHERE id = ?').run(json, id)
}

export function updateSettings(db: Database, id: number, json: string) {
  db.prepare('UPDATE dg_projects SET settings_json = ? WHERE id = ?').run(json, id)
}

export function deleteProject(db: Database, id: number) {
  db.prepare('DELETE FROM dg_projects WHERE id = ?').run(id)
}
