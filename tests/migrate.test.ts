import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { currentVersion, runDiagramMigrations } from '../src/main/diagram/migrate'
import { MIGRATIONS, type Migration } from '../src/main/diagram/migrations'

const dbs: Database.Database[] = []
const memory = () => {
  const db = new Database(':memory:')
  dbs.push(db)
  return db
}

afterEach(() => {
  while (dbs.length) dbs.pop()?.close()
})

const tableNames = (db: Database.Database) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string
    }[]
  ).map((r) => r.name)

describe('runDiagramMigrations', () => {
  it('creates the dg_* tables on an empty database', () => {
    const db = memory()
    expect(runDiagramMigrations(db)).toEqual({ from: 0, to: 2 })
    expect(tableNames(db)).toEqual([
      'dg_groups',
      'dg_images',
      'dg_links',
      'dg_nodes',
      'dg_pins',
      'dg_projects',
      'dg_scenarios',
      'dg_schema_version',
      'dg_steps'
    ])
  })

  it('running twice is harmless and dg_schema_version stays at the latest', () => {
    const db = memory()
    runDiagramMigrations(db)
    expect(runDiagramMigrations(db)).toEqual({ from: 2, to: 2 })
    expect(db.prepare('SELECT version FROM dg_schema_version').all()).toEqual([{ version: 2 }])
    expect(currentVersion(db)).toBe(2)
  })

  it('applies a later migration once and bumps the version', () => {
    const db = memory()
    runDiagramMigrations(db)
    const extra: Migration = {
      version: 3,
      name: 'extra',
      sql: 'CREATE TABLE dg_extra (id INTEGER PRIMARY KEY);'
    }
    expect(runDiagramMigrations(db, [...MIGRATIONS, extra])).toEqual({ from: 2, to: 3 })
    expect(runDiagramMigrations(db, [...MIGRATIONS, extra])).toEqual({ from: 3, to: 3 })
    expect(db.prepare('SELECT version FROM dg_schema_version').all()).toEqual([{ version: 3 }])
  })

  it('rolls back a failing migration completely', () => {
    const db = memory()
    runDiagramMigrations(db)
    const broken: Migration = {
      version: 3,
      name: 'broken',
      sql: 'CREATE TABLE dg_half (id INTEGER); THIS IS NOT SQL;'
    }
    expect(() => runDiagramMigrations(db, [...MIGRATIONS, broken])).toThrow()
    expect(tableNames(db)).not.toContain('dg_half')
    expect(currentVersion(db)).toBe(2)
  })

  it('enforces the constraints of TDD 5.2', () => {
    const db = memory()
    db.pragma('foreign_keys = ON')
    runDiagramMigrations(db)
    db.prepare(
      "INSERT INTO dg_projects (code, name, name_norm, folder, created_at, updated_at) VALUES (1,'A','a','du-an/0001-a','t','t')"
    ).run()
    expect(() =>
      db
        .prepare(
          "INSERT INTO dg_nodes (project_id, key, type, code, title, created_at, updated_at) VALUES (1,'N1','bogus','c','t','t','t')"
        )
        .run()
    ).toThrow(/CHECK/)
    db.prepare(
      "INSERT INTO dg_nodes (project_id, key, type, code, title, created_at, updated_at) VALUES (1,'N1','fnc','c','t','t','t')"
    ).run()
    // Deleting the project removes its nodes (ON DELETE CASCADE).
    db.prepare('DELETE FROM dg_projects WHERE id = 1').run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM dg_nodes').get()).toEqual({ n: 0 })
  })
})

describe('merge into studyapp [TH]', () => {
  it('leaves PRAGMA user_version and foreign tables alone', () => {
    const db = memory()
    db.pragma('user_version = 3')
    db.exec(
      "CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT); INSERT INTO items (title) VALUES ('kien thuc');"
    )
    runDiagramMigrations(db)
    runDiagramMigrations(db)
    expect(db.pragma('user_version', { simple: true })).toBe(3)
    expect(db.prepare('SELECT title FROM items').all()).toEqual([{ title: 'kien thuc' }])
    const names = tableNames(db)
    expect(names).toContain('items')
    expect(names.filter((n) => n !== 'items').every((n) => n.startsWith('dg_'))).toBe(true)
  })
})
