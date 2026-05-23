import { contextBridge, ipcRenderer } from 'electron'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode } from '../core/types'

export interface PrebaseAPI {
  openProjectDialog: () => Promise<string | null>
  openProject: (path: string) => Promise<{ success: boolean; snapshot?: GraphSnapshot; error?: string }>
  closeProject: () => Promise<{ success: boolean }>
  getSnapshot: () => Promise<GraphSnapshot | null>
  relayout: (mode: LayoutMode) => Promise<GraphSnapshot | null>
  onGraphFull: (callback: (snapshot: GraphSnapshot) => void) => () => void
  onGraphIncremental: (callback: (update: IncrementalUpdate) => void) => () => void
}

const api: PrebaseAPI = {
  openProjectDialog: () => ipcRenderer.invoke('project:open-dialog'),
  openProject: (path) => ipcRenderer.invoke('project:open', path),
  closeProject: () => ipcRenderer.invoke('project:close'),
  getSnapshot: () => ipcRenderer.invoke('project:get-snapshot'),
  relayout: (mode) => ipcRenderer.invoke('graph:relayout', mode),
  onGraphFull: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, snapshot: GraphSnapshot) => callback(snapshot)
    ipcRenderer.on('graph:full', handler)
    return () => ipcRenderer.removeListener('graph:full', handler)
  },
  onGraphIncremental: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, update: IncrementalUpdate) => callback(update)
    ipcRenderer.on('graph:incremental', handler)
    return () => ipcRenderer.removeListener('graph:incremental', handler)
  }
}

contextBridge.exposeInMainWorld('prebase', api)
