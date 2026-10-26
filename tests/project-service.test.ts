import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DiagramError } from '../src/main/diagram/errors'
import { createProjectService, trashStamp } from '../src/main/diagram/services/project'
import { DEFAULT_PROJECT_SETTINGS } from '../src/shared/diagram/types'
import { makeKho, makeTempDir, removeDir, silentLogger } from './helpers/kho'

let kho: ReturnType<typeof makeKho>
let clock: Date
let service: ReturnType<typeof createProjectService>

beforeEach(() => {
  kho = makeKho()
  clock = new Date(2026, 9, 24, 20, 35, 10)
  service = createProjectService(
    { db: kho.db, khoRoot: kho.root, logger: silentLogger },
    { now: () => clock }
  )
})
afterEach(() => kho.cleanup())

const codeOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof DiagramError ? e.code : 'other'
  }
  return null
}

describe('project.create', () => {
  it('creates the row and du-an/<code>-<slug>/anh/', () => {
    const p = service.create('MOE EA')
    expect(p).toMatchObject({ code: 1, name: 'MOE EA', folder: 'du-an/0001-moe-ea', nodeCount: 0 })
    expect(p.docsRoot).toBeNull()
    expect(existsSync(join(kho.root, 'du-an', '0001-moe-ea', 'anh'))).toBe(true)
  })

  it('trims and collapses spaces in the name', () => {
    expect(service.create('  MOE   Education  Account ').name).toBe('MOE Education Account')
  })

  it('rejects a duplicate ignoring case and accents (FR-DA-02)', () => {
    service.create('MOE EA')
    expect(codeOf(() => service.create('moe ea'))).toBe('NAME_DUPLICATE')
    expect(codeOf(() => service.create('  Moe   EA '))).toBe('NAME_DUPLICATE')
    service.create('Dự án Đầu Tiên')
    expect(codeOf(() => service.create('du an dau tien'))).toBe('NAME_DUPLICATE')
    expect(service.list()).toHaveLength(2)
  })

  it('rejects an empty name and a name over 80 characters', () => {
    expect(codeOf(() => service.create('   '))).toBe('NAME_EMPTY')
    expect(codeOf(() => service.create('x'.repeat(81)))).toBe('NAME_TOO_LONG')
    expect(() => service.create('x'.repeat(80))).not.toThrow()
    expect(codeOf(() => service.create(42))).toBe('INVALID_ARGUMENT')
  })

  it('leaves no folder behind when a name is rejected', () => {
    service.create('A')
    codeOf(() => service.create('a'))
    expect(readdirSync(join(kho.root, 'du-an'))).toEqual(['0001-a'])
  })

  it('codes grow and are not reused after the newest project is removed', () => {
    service.create('One')
    service.create('Two')
    const three = service.create('Three')
    expect(three.code).toBe(3)
    service.remove(three.id)
    expect(service.create('Four').code).toBe(4)
  })

  it('does not reuse a code that only survives in thung-rac/', () => {
    mkdirSync(join(kho.root, 'thung-rac', '0007-old_20260101-000000'), { recursive: true })
    expect(service.create('Fresh').code).toBe(8)
  })

  it('names the folder with a fallback slug when the name has no letters', () => {
    expect(service.create('!!!').folder).toBe('du-an/0001-du-an')
  })
})

describe('project.list', () => {
  it('lists newest edit first with the block count', () => {
    const a = service.create('A')
    clock = new Date(2026, 9, 24, 21, 0, 0)
    const b = service.create('B')
    kho.db
      .prepare(
        "INSERT INTO dg_nodes (project_id, key, type, code, title, created_at, updated_at) VALUES (?, 'N1', 'fnc', 'c', 't', 't', 't')"
      )
      .run(a.id)
    const list = service.list()
    expect(list.map((p) => p.name)).toEqual(['B', 'A'])
    expect(list.find((p) => p.id === a.id)?.nodeCount).toBe(1)
    expect(list.find((p) => p.id === b.id)?.nodeCount).toBe(0)
  })
})

describe('project.rename', () => {
  it('renames, keeps the folder, and allows changing only the case of its own name', () => {
    const p = service.create('moe ea')
    const renamed = service.rename(p.id, 'MOE EA')
    expect(renamed.name).toBe('MOE EA')
    expect(renamed.folder).toBe(p.folder)
  })

  it('refuses the name of another project and an unknown id', () => {
    service.create('A')
    const b = service.create('B')
    expect(codeOf(() => service.rename(b.id, 'a'))).toBe('NAME_DUPLICATE')
    expect(codeOf(() => service.rename(999, 'Z'))).toBe('PROJECT_NOT_FOUND')
    expect(codeOf(() => service.rename('1', 'Z'))).toBe('INVALID_ARGUMENT')
  })
})

describe('project.remove', () => {
  it('moves the folder into thung-rac/ with a time stamp, then deletes the row (FR-DA-02 AC2)', () => {
    const p = service.create('MOE EA')
    writeFileSync(join(kho.root, p.folder, 'anh', 'keep.png'), 'img')
    const { trashFolder } = service.remove(p.id)
    expect(trashFolder).toBe('thung-rac/0001-moe-ea_20261024-203510')
    expect(existsSync(join(kho.root, p.folder))).toBe(false)
    expect(existsSync(join(kho.root, trashFolder as string, 'anh', 'keep.png'))).toBe(true)
    expect(service.list()).toEqual([])
  })

  it('removes the children of the project with it', () => {
    const p = service.create('A')
    kho.db
      .prepare(
        "INSERT INTO dg_nodes (project_id, key, type, code, title, created_at, updated_at) VALUES (?, 'N1', 'fnc', 'c', 't', 't', 't')"
      )
      .run(p.id)
    service.remove(p.id)
    expect(kho.db.prepare('SELECT COUNT(*) AS n FROM dg_nodes').get()).toEqual({ n: 0 })
  })

  it('still works when the folder is already missing', () => {
    const p = service.create('A')
    removeDir(join(kho.root, p.folder))
    expect(service.remove(p.id)).toEqual({ trashFolder: null })
    expect(codeOf(() => service.remove(p.id))).toBe('PROJECT_NOT_FOUND')
  })

  it('allows the name again after removal', () => {
    const p = service.create('A')
    service.remove(p.id)
    expect(service.create('a').code).toBe(2)
  })

  it('trashStamp uses the local clock', () => {
    expect(trashStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405')
  })
})

describe('project.load', () => {
  it('returns the full structure with empty content arrays', () => {
    const p = service.create('A')
    const data = service.load(p.id)
    expect(Object.keys(data).sort()).toEqual(
      [
        'groups',
        'images',
        'links',
        'nodes',
        'pins',
        'project',
        'scenarios',
        'settings',
        'steps',
        'viewport'
      ].sort()
    )
    expect(data.project.id).toBe(p.id)
    expect(data.nodes).toEqual([])
    expect(data.viewport).toBeNull()
    expect(data.settings).toEqual(DEFAULT_PROJECT_SETTINGS)
  })

  it('ignores a damaged viewport or settings value in the database', () => {
    const p = service.create('A')
    kho.db
      .prepare('UPDATE dg_projects SET viewport_json = ?, settings_json = ? WHERE id = ?')
      .run('{oops', '[1,2', p.id)
    const data = service.load(p.id)
    expect(data.viewport).toBeNull()
    expect(data.settings).toEqual(DEFAULT_PROJECT_SETTINGS)
  })
})

describe('project.setDocsRoot, saveViewport, saveSettings', () => {
  it('stores the docs root (the only absolute path) and clears it', () => {
    const p = service.create('A')
    const docs = makeTempDir('mapapp-docs-')
    try {
      expect(service.setDocsRoot(p.id, docs).docsRoot).toBe(docs)
      expect(service.load(p.id).project.docsRoot).toBe(docs)
      expect(service.setDocsRoot(p.id, null).docsRoot).toBeNull()
      expect(codeOf(() => service.setDocsRoot(p.id, join(docs, 'missing')))).toBe(
        'DOCS_ROOT_INVALID'
      )
    } finally {
      removeDir(docs)
    }
  })

  it('saves and reloads the viewport, rejects nonsense', () => {
    const p = service.create('A')
    service.saveViewport(p.id, { x: 10, y: -20.5, zoom: 0.8 })
    expect(service.load(p.id).viewport).toEqual({ x: 10, y: -20.5, zoom: 0.8 })
    expect(codeOf(() => service.saveViewport(p.id, { x: 1, y: 1, zoom: 0 }))).toBe(
      'VIEWPORT_INVALID'
    )
    expect(codeOf(() => service.saveViewport(p.id, { x: NaN, y: 1, zoom: 1 }))).toBe(
      'VIEWPORT_INVALID'
    )
    expect(codeOf(() => service.saveViewport(p.id, null))).toBe('VIEWPORT_INVALID')
  })

  it('merges settings patches and validates them', () => {
    const p = service.create('A')
    expect(service.saveSettings(p.id, { theme: 'light' })).toEqual({
      ...DEFAULT_PROJECT_SETTINGS,
      theme: 'light'
    })
    expect(service.saveSettings(p.id, { channelMode: 'many' }).theme).toBe('light')
    expect(service.load(p.id).settings).toEqual({
      channelMode: 'many',
      playImages: true,
      theme: 'light'
    })
    expect(codeOf(() => service.saveSettings(p.id, { theme: 'blue' }))).toBe('SETTINGS_INVALID')
    expect(codeOf(() => service.saveSettings(p.id, { hacker: 1 }))).toBe('SETTINGS_INVALID')
    expect(codeOf(() => service.saveSettings(p.id, 'x'))).toBe('SETTINGS_INVALID')
  })
})
