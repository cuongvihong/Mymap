import { pathToFileURL } from 'node:url'
import type { CustomScheme, Net, Protocol } from 'electron'
import { currentImageFile, IMAGE_SCHEME } from './imageProtocol'

/**
 * The scheme entry the host puts into `protocol.registerSchemesAsPrivileged([...])` before `ready`.
 * Electron accepts that call once, so the host merges this entry with its own schemes (TDD 11).
 */
export const DIAGRAM_SCHEME: CustomScheme = {
  scheme: IMAGE_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}

/**
 * After `ready`: serves `mapimg://<projectId>/anh/<file>` from the open project folder.
 * Electron objects are passed in, so this file does not load Electron itself.
 */
export function handleDiagramProtocol(
  protocol: Pick<Protocol, 'handle'>,
  net: Pick<Net, 'fetch'>
): void {
  protocol.handle(IMAGE_SCHEME, (request) => {
    const file = currentImageFile(request.url)
    if (!file) return new Response('', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}
