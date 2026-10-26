import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { SHELL_CHANNELS, type AppInfo, type KhoHealth, type MapAppApi } from '../shared/api'
import { createDiagramApi } from '../shared/diagram/ipcClient'

// The renderer only ever sees this typed object (MASTER 4.3). The diagram part is built by the module.
const diagram = createDiagramApi(
  (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  }
)

const k = SHELL_CHANNELS.kho
const api: MapAppApi = {
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke(SHELL_CHANNELS.appInfo)
  },
  shell: {
    kho: {
      status: () => ipcRenderer.invoke(k.status),
      create: () => ipcRenderer.invoke(k.create),
      open: () => ipcRenderer.invoke(k.open),
      openRecent: (root) => ipcRenderer.invoke(k.openRecent, root),
      setLastProject: (id) => ipcRenderer.invoke(k.setLastProject, id),
      onHealth: (listener) => {
        const handler = (_event: unknown, health: KhoHealth) => listener(health)
        ipcRenderer.on(k.health, handler)
        return () => {
          ipcRenderer.removeListener(k.health, handler)
        }
      }
    }
  },
  diagram
}

contextBridge.exposeInMainWorld('api', api)
