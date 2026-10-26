import type { Database } from 'better-sqlite3'
import type { ImageData, PinData } from '../../../shared/diagram/types'

export function listImages(db: Database, projectId: number): ImageData[] {
  const rows = db
    .prepare(
      `SELECT i.* FROM dg_images i JOIN dg_nodes n ON n.id = i.node_id
       WHERE n.project_id = ? ORDER BY i.node_id, i.sort_order, i.id`
    )
    .all(projectId) as {
    id: number
    node_id: number
    rel_path: string
    width: number
    height: number
    caption: string
    sort_order: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    nodeId: r.node_id,
    relPath: r.rel_path,
    width: r.width,
    height: r.height,
    caption: r.caption,
    sortOrder: r.sort_order
  }))
}

export function listPins(db: Database, projectId: number): PinData[] {
  const rows = db
    .prepare(
      `SELECT p.* FROM dg_pins p
       JOIN dg_images i ON i.id = p.image_id JOIN dg_nodes n ON n.id = i.node_id
       WHERE n.project_id = ? ORDER BY p.image_id, p.sort_order, p.id`
    )
    .all(projectId) as {
    id: number
    image_id: number
    x_pct: number
    y_pct: number
    note: string
    sort_order: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    imageId: r.image_id,
    xPct: r.x_pct,
    yPct: r.y_pct,
    note: r.note,
    sortOrder: r.sort_order
  }))
}

export interface ImageRecord extends ImageData {
  projectId: number
}

interface ImageRow {
  id: number
  node_id: number
  rel_path: string
  width: number
  height: number
  caption: string
  sort_order: number
  project_id: number
}

export function getImage(db: Database, id: number): ImageRecord | null {
  const r = db
    .prepare(
      `SELECT i.*, n.project_id FROM dg_images i JOIN dg_nodes n ON n.id = i.node_id WHERE i.id = ?`
    )
    .get(id) as ImageRow | undefined
  if (!r) return null
  return {
    id: r.id,
    nodeId: r.node_id,
    relPath: r.rel_path,
    width: r.width,
    height: r.height,
    caption: r.caption,
    sortOrder: r.sort_order,
    projectId: r.project_id
  }
}

export function toData({ projectId: _projectId, ...data }: ImageRecord): ImageData {
  void _projectId
  return data
}

export function countImages(db: Database, nodeId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM dg_images WHERE node_id = ?').get(nodeId) as {
    c: number
  }
  return row.c
}

export function nextImageOrder(db: Database, nodeId: number): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM dg_images WHERE node_id = ?')
    .get(nodeId) as { n: number }
  return row.n
}

export function insertImage(db: Database, image: Omit<ImageData, 'id'>): number {
  const info = db
    .prepare(
      `INSERT INTO dg_images (node_id, rel_path, width, height, caption, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(image.nodeId, image.relPath, image.width, image.height, image.caption, image.sortOrder)
  return Number(info.lastInsertRowid)
}

export function setCaption(db: Database, id: number, caption: string): void {
  db.prepare('UPDATE dg_images SET caption = ? WHERE id = ?').run(caption, id)
}

export function deleteImage(db: Database, id: number): void {
  db.prepare('DELETE FROM dg_images WHERE id = ?').run(id)
}

export function imageIdsOfNode(db: Database, nodeId: number): number[] {
  return (
    db
      .prepare('SELECT id FROM dg_images WHERE node_id = ? ORDER BY sort_order, id')
      .all(nodeId) as {
      id: number
    }[]
  ).map((r) => r.id)
}

export function setImageOrder(db: Database, ids: readonly number[]): void {
  const stmt = db.prepare('UPDATE dg_images SET sort_order = ? WHERE id = ?')
  ids.forEach((id, i) => stmt.run(i, id))
}

/** Every rel_path of the project, to tell which files in anh/ are still in use. */
export function referencedPaths(db: Database, projectId: number): Set<string> {
  const rows = db
    .prepare(
      `SELECT i.rel_path FROM dg_images i JOIN dg_nodes n ON n.id = i.node_id WHERE n.project_id = ?`
    )
    .all(projectId) as { rel_path: string }[]
  return new Set(rows.map((r) => r.rel_path))
}

export interface PinRecord extends PinData {
  projectId: number
}

export function getPin(db: Database, id: number): PinRecord | null {
  const r = db
    .prepare(
      `SELECT p.*, n.project_id FROM dg_pins p
       JOIN dg_images i ON i.id = p.image_id JOIN dg_nodes n ON n.id = i.node_id WHERE p.id = ?`
    )
    .get(id) as
    | {
        id: number
        image_id: number
        x_pct: number
        y_pct: number
        note: string
        sort_order: number
        project_id: number
      }
    | undefined
  if (!r) return null
  return {
    id: r.id,
    imageId: r.image_id,
    xPct: r.x_pct,
    yPct: r.y_pct,
    note: r.note,
    sortOrder: r.sort_order,
    projectId: r.project_id
  }
}

export function pinToData({ projectId: _projectId, ...data }: PinRecord): PinData {
  void _projectId
  return data
}

export function countPins(db: Database, imageId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM dg_pins WHERE image_id = ?').get(imageId) as {
    c: number
  }
  return row.c
}

export function nextPinOrder(db: Database, imageId: number): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM dg_pins WHERE image_id = ?')
    .get(imageId) as { n: number }
  return row.n
}

export function insertPin(db: Database, pin: Omit<PinData, 'id'>): number {
  const info = db
    .prepare(
      `INSERT INTO dg_pins (image_id, x_pct, y_pct, note, sort_order) VALUES (?, ?, ?, ?, ?)`
    )
    .run(pin.imageId, pin.xPct, pin.yPct, pin.note, pin.sortOrder)
  return Number(info.lastInsertRowid)
}

export function updatePin(
  db: Database,
  id: number,
  pin: { xPct: number; yPct: number; note: string }
): void {
  db.prepare('UPDATE dg_pins SET x_pct = ?, y_pct = ?, note = ? WHERE id = ?').run(
    pin.xPct,
    pin.yPct,
    pin.note,
    id
  )
}

export function deletePin(db: Database, id: number): void {
  db.prepare('DELETE FROM dg_pins WHERE id = ?').run(id)
}

export function pinIdsOfImage(db: Database, imageId: number): number[] {
  return (
    db
      .prepare('SELECT id FROM dg_pins WHERE image_id = ? ORDER BY sort_order, id')
      .all(imageId) as {
      id: number
    }[]
  ).map((r) => r.id)
}

export function setPinOrder(db: Database, ids: readonly number[]): void {
  const stmt = db.prepare('UPDATE dg_pins SET sort_order = ? WHERE id = ?')
  ids.forEach((id, i) => stmt.run(i, id))
}
