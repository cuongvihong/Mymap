import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  declaredCssVars,
  declaredTsVars,
  findBadIpcChannels,
  findShellCssRefs,
  findShellImports,
  listFiles,
  notDgVar,
  readText
} from './helpers/boundary'

const root = join(__dirname, '..')
const MODULE_DIRS = ['src/shared/diagram', 'src/main/diagram', 'src/renderer/features/diagram']
const rel = (file: string) => relative(root, file).replaceAll('\\', '/')

describe('module boundary [TH] (MASTER 4.4)', () => {
  it.each(MODULE_DIRS)('%s exists', (dir) => {
    expect(existsSync(join(root, dir))).toBe(true)
  })

  it('no file of the diagram module imports from shell/', () => {
    const violations: string[] = []
    for (const dir of MODULE_DIRS) {
      for (const file of listFiles(join(root, dir), ['.ts', '.tsx', '.js', '.mjs'])) {
        for (const spec of findShellImports(readText(file)))
          violations.push(`${rel(file)} imports ${spec}`)
      }
      for (const file of listFiles(join(root, dir), ['.css'])) {
        for (const spec of findShellCssRefs(readText(file)))
          violations.push(`${rel(file)} references ${spec}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('shared/diagram is pure: no Electron, React or Node imports', () => {
    const violations: string[] = []
    for (const file of listFiles(join(root, 'src/shared/diagram'), ['.ts', '.tsx'])) {
      const text = readText(file)
      for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1] as string
        if (spec === 'electron' || spec.startsWith('react') || spec.startsWith('node:')) {
          violations.push(`${rel(file)} imports ${spec}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('every IPC channel string in main/diagram starts with "diagram:"', () => {
    const violations: string[] = []
    for (const file of listFiles(join(root, 'src/main/diagram'), ['.ts'])) {
      for (const channel of findBadIpcChannels(readText(file)))
        violations.push(`${rel(file)}: ${channel}`)
    }
    expect(violations).toEqual([])
  })

  it('every CSS variable declared in features/diagram starts with "--dg-"', () => {
    const violations: string[] = []
    const dir = join(root, 'src/renderer/features/diagram')
    for (const file of listFiles(dir, ['.css'])) {
      for (const name of declaredCssVars(readText(file)).filter(notDgVar))
        violations.push(`${rel(file)}: ${name}`)
    }
    for (const file of listFiles(dir, ['.ts', '.tsx'])) {
      for (const name of declaredTsVars(readText(file)).filter(notDgVar))
        violations.push(`${rel(file)}: ${name}`)
    }
    expect(violations).toEqual([])
  })

  it('shared/diagram stays free of Electron, React and Node imports', () => {
    const violations: string[] = []
    for (const file of listFiles(join(root, 'src/shared/diagram'), ['.ts'])) {
      for (const spec of [...readText(file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
        (m) => m[1] as string
      )) {
        if (/^(electron|react|react-dom|node:)/.test(spec))
          violations.push(`${rel(file)} imports ${spec}`)
      }
    }
    expect(violations).toEqual([])
  })
})

describe('boundary detectors catch violations', () => {
  it('finds imports that point into shell/', () => {
    expect(findShellImports(`import { x } from '../../shell/store'`)).toEqual(['../../shell/store'])
    expect(findShellImports(`import type { Y } from '@/shell/types'`)).toEqual(['@/shell/types'])
    expect(findShellImports(`export * from '../shell'`)).toEqual(['../shell'])
    expect(findShellImports(`const m = await import('../../main/shell/logger')`)).toEqual([
      '../../main/shell/logger'
    ])
    expect(findShellImports(`const m = require('../shell/x')`)).toEqual(['../shell/x'])
  })

  it('ignores imports that are allowed', () => {
    expect(
      findShellImports(`import { a } from '../../shared/diagram/types'\nimport 'react'`)
    ).toEqual([])
  })

  it('finds channels without the diagram: prefix', () => {
    const src = `ipcMain.handle('diagram:project:list', f)\nipcMain.handle('project:list', g)\nwebContents.send("fs-missing")`
    expect(findBadIpcChannels(src)).toEqual(['project:list', 'fs-missing'])
  })

  it('finds CSS variables outside the --dg- namespace', () => {
    const css = `.a { --dg-ok: 1; --bad: 2; color: var(--dg-ok); }\n/* --commented: 3 */`
    expect(declaredCssVars(css).filter(notDgVar)).toEqual(['--bad'])
    const ts = `const s = { '--oops': 1, '--dg-fine': 2 }; el.style.setProperty('--other', 'x')`
    expect(declaredTsVars(ts).filter(notDgVar)).toEqual(['--oops', '--other'])
  })

  it('finds shell references in CSS', () => {
    expect(findShellCssRefs(`@import '../../shell/base.css';`)).toEqual(['../../shell/base.css'])
  })
})
