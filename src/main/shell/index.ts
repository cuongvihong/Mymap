import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { release } from 'node:os'
import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { computeAppDir } from '../../shared/appdir'
import { SHELL_CHANNELS, type AppInfo } from '../../shared/api'
import { DIAGRAM_SCHEME, handleDiagramProtocol } from '../diagram/electronProtocol'
import { findSampleFile, seedSampleProject } from '../diagram/seed'
import { registerKhoIpc } from './kho/ipc'
import { KhoManager } from './kho/manager'
import { createLogger } from './logger'

// Portable mode (MASTER 4.6): everything lives under appDir, nothing in AppData or ~/.config.
// This block must run before app.whenReady().
const isDev = !app.isPackaged
const appDir = computeAppDir(process.env, process.execPath, isDev, process.cwd())
const dataDir = join(appDir, 'electron-data')
const logsDir = join(appDir, 'logs')
mkdirSync(dataDir, { recursive: true })
mkdirSync(logsDir, { recursive: true })
app.setPath('userData', dataDir)
app.setPath('sessionData', dataDir)
app.setPath('crashDumps', join(dataDir, 'crashes'))
app.setAppLogsPath(logsDir)

const logger = createLogger(logsDir)

// mapimg://<projectId>/anh/<file> serves block images from the project folder (TDD 8.7).
protocol.registerSchemesAsPrivileged([DIAGRAM_SCHEME])

/** Window and taskbar icon. The Windows exe has its own copy embedded by electron-builder. */
const ICON_FILE = join(app.getAppPath(), 'build', 'icon.png')

let mainWindow: BrowserWindow | null = null

const khoManager = new KhoManager({
  appDir,
  configFile: join(appDir, 'config.json'),
  logger,
  ipcMain,
  // Dev only: MAPAPP_SEED=1 npm run dev creates the sample project in an empty Kho.
  onOpen:
    isDev && process.env['MAPAPP_SEED'] === '1'
      ? (ctx) => {
          const sample = findSampleFile(process.cwd())
          if (sample) seedSampleProject(ctx, sample)
          else logger.warn('seed sample not found')
        }
      : undefined,
  emitHealth: (health) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(SHELL_CHANNELS.kho.health, health)
    }
  }
})

const WINDOW_BACKGROUND = '#16171a'

function osName(): string {
  switch (process.platform) {
    case 'win32':
      return 'Windows'
    case 'linux':
      return 'Linux'
    case 'darwin':
      return 'macOS'
    default:
      return process.platform
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    title: 'MapApp',
    ...(existsSync(ICON_FILE) ? { icon: ICON_FILE } : {}),
    backgroundColor: WINDOW_BACKGROUND,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // The renderer never opens new windows or leaves the app page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!devUrl || !url.startsWith(devUrl)) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  return win
}

function registerShellIpc(): void {
  ipcMain.handle(SHELL_CHANNELS.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    appDir,
    platform: process.platform,
    osName: `${osName()} ${release()}`,
    arch: process.arch,
    isDev
  }))
}

void app.whenReady().then(() => {
  handleDiagramProtocol(protocol, net)
  registerShellIpc()
  registerKhoIpc({ ipcMain, dialog, getWindow: () => mainWindow, manager: khoManager })
  khoManager.startup()
  logger.prune()
  logger.info('app ready', { version: app.getVersion(), platform: process.platform, isDev })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => khoManager.close())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
