import { posix, win32 } from 'node:path'

/**
 * Environment variables that matter for locating the app folder.
 * APPIMAGE is set by the AppImage runtime. APPIMAGE_ORIG_DIR is exported by
 * scripts/mo-mapapp-linux.sh and points at the folder that holds the AppImage.
 */
export interface AppDirEnv {
  APPIMAGE?: string
  APPIMAGE_ORIG_DIR?: string
  [key: string]: string | undefined
}

/** Folder name used next to the project root while developing. */
export const DEV_APP_DIR_NAME = '.dev-app'

const looksLikeWindowsPath = (p: string): boolean => /^[A-Za-z]:[\\/]/.test(p) || p.includes('\\')

/**
 * Compute `appDir`, the `app/` folder of the Kho (storage root).
 *
 * Kho layout (TDD 4):
 *   <Kho>/app/win/MapApp.exe          Windows unpacked build
 *   <Kho>/app/linux/MapApp.AppImage   Linux AppImage
 *
 * - dev: `<cwd>/.dev-app`
 * - Windows: parent of the folder that holds the exe
 * - AppImage: parent of the folder that holds the AppImage. The mounted
 *   execPath inside /tmp/.mount_* is useless, so APPIMAGE_ORIG_DIR is used
 *   first, then dirname(APPIMAGE).
 * - Anything else (for example an unpacked Linux build): parent of the folder
 *   that holds the executable.
 *
 * Pure function, no file system access. `cwd` is only read in dev mode.
 */
export function computeAppDir(
  env: AppDirEnv,
  execPath: string,
  isDev: boolean,
  cwd: string = '.'
): string {
  if (isDev) {
    const p = looksLikeWindowsPath(cwd) ? win32 : posix
    return p.join(cwd, DEV_APP_DIR_NAME)
  }

  const appImage = env.APPIMAGE?.trim()
  const origDir = env.APPIMAGE_ORIG_DIR?.trim()
  if (origDir) return posix.dirname(stripTrailingSlash(origDir))
  if (appImage) return posix.dirname(posix.dirname(appImage))

  const p = looksLikeWindowsPath(execPath) ? win32 : posix
  return p.dirname(p.dirname(execPath))
}

function stripTrailingSlash(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}
