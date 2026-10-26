import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { DiagramError } from '../src/main/diagram/errors'
import { createFsService, resolveDoc } from '../src/main/diagram/services/fs'
import { createNodeService } from '../src/main/diagram/services/node'
import { createProjectService } from '../src/main/diagram/services/project'
import { makeKho, makeTempDir, removeDir, silentLogger } from './helpers/kho'

let kho: ReturnType<typeof makeKho>
let docs: string
let ctx: DiagramContext
let projectId: number
let nodeId: number
const opened: string[] = []
let openResult = ''

const fsService = () =>
  createFsService(ctx, {
    openPath: async (p) => {
      opened.push(p)
      return openResult
    }
  })

const codeOf = async (fn: () => unknown): Promise<string> => {
  try {
    await fn()
  } catch (e) {
    if (e instanceof DiagramError) return e.code
    throw e
  }
  return 'NO_ERROR'
}

beforeEach(() => {
  kho = makeKho()
  docs = makeTempDir('mapapp-docs-')
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  opened.length = 0
  openResult = ''
  const project = createProjectService(ctx)
  projectId = project.create('FS').id
  nodeId = createNodeService(ctx).create(projectId, {
    type: 'fnc',
    title: 'Chọn cách thanh toán',
    fsFile: '[Agile] FS 09.docx'
  }).id
})
afterEach(() => {
  kho.cleanup()
  removeDir(docs)
})

describe('resolveDoc', () => {
  it('joins a relative path and refuses anything that leaves the folder', () => {
    expect(resolveDoc(docs, 'a.docx')).toBe(join(docs, 'a.docx'))
    expect(resolveDoc(docs, 'sub/b.docx')).toBe(join(docs, 'sub', 'b.docx'))
    expect(resolveDoc(docs, '../x.docx')).toBeNull()
    expect(resolveDoc(docs, 'sub/../../x.docx')).toBeNull()
    expect(resolveDoc(docs, '/etc/passwd')).toBeNull()
    expect(resolveDoc(docs, '')).toBeNull()
    expect(resolveDoc(docs, '.')).toBeNull()
  })
})

describe('fs service', () => {
  it('open needs a documents folder, then the file, then hands the full path to the system', async () => {
    const fs = fsService()
    expect(await codeOf(() => fs.open(nodeId))).toBe('FS_NO_ROOT')

    createProjectService(ctx).setDocsRoot(projectId, docs)
    expect(await codeOf(() => fs.open(nodeId))).toBe('FS_NOT_FOUND')

    writeFileSync(join(docs, '[Agile] FS 09.docx'), 'x')
    await fs.open(nodeId)
    expect(opened).toEqual([join(docs, '[Agile] FS 09.docx')])

    openResult = 'No application'
    expect(await codeOf(() => fs.open(nodeId))).toBe('FS_OPEN_FAILED')
    expect(await codeOf(() => fs.open(999))).toBe('NODE_NOT_FOUND')
    expect(await codeOf(() => fs.open('1'))).toBe('INVALID_ARGUMENT')
  })

  it('exists reports each path, false for all when no folder is set or the path escapes', () => {
    const fs = fsService()
    expect(fs.exists(projectId, ['a.docx'])).toEqual({ 'a.docx': false })

    createProjectService(ctx).setDocsRoot(projectId, docs)
    mkdirSync(join(docs, 'sub'))
    writeFileSync(join(docs, 'a.docx'), 'x')
    writeFileSync(join(docs, 'sub', 'b.docx'), 'x')
    expect(fs.exists(projectId, ['a.docx', 'sub/b.docx', 'sub', 'c.docx', '../a.docx'])).toEqual({
      'a.docx': true,
      'sub/b.docx': true,
      sub: false,
      'c.docx': false,
      '../a.docx': false
    })
    expect(() => fs.exists(projectId, 'a.docx')).toThrow(DiagramError)
    expect(() => fs.exists(12345, [])).toThrow(DiagramError)
  })
})
