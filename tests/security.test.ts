import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Electron security settings (MASTER 4.3)', () => {
  const main = read('src/main/shell/index.ts')

  it('window uses contextIsolation, no nodeIntegration, sandbox', () => {
    expect(main).toMatch(/contextIsolation:\s*true/)
    expect(main).toMatch(/nodeIntegration:\s*false/)
    expect(main).toMatch(/sandbox:\s*true/)
  })

  it('sets userData before the app is ready (MASTER 4.6)', () => {
    const setPath = main.indexOf("app.setPath('userData'")
    const whenReady = main.indexOf('app.whenReady().then')
    expect(setPath).toBeGreaterThan(-1)
    expect(whenReady).toBeGreaterThan(setPath)
  })

  it('preload exposes only the api object', () => {
    const preload = read('src/preload/index.ts')
    expect(preload).toContain("exposeInMainWorld('api', api)")
    expect(preload.match(/exposeInMainWorld/g)).toHaveLength(1)
  })

  it('renderer page has a Content Security Policy without remote origins', () => {
    const html = read('src/renderer/index.html')
    expect(html).toContain('Content-Security-Policy')
    expect(html).not.toMatch(/https?:\/\//)
  })
})
