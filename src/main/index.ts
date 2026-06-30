import { config as loadEnv } from 'dotenv'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { resolveProjectFilePath } from '../core/utils/path-utils'
import { ProjectService } from '../core/services/project-service'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode } from '../core/types'
import {
  describeFile,
  describeLayer,
  isGeminiAvailable,
  type DescribeFileParams,
  type DescribeLayerParams
} from './ai/geminiService'
import { magnusChat, geminiPing, type MagnusChatParams } from './ai/magnusService'
import { logKeyDiagnostics } from './ai/apiKeyLoader'

// Load .env — best-effort; apiKeyLoader reads the file directly so this is a secondary path.
const dotenvPath = resolve(process.cwd(), '.env')
loadEnv({ path: dotenvPath, override: true })

// Print key diagnostics to the main-process console in dev mode.
logKeyDiagnostics()

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
const projectService = new ProjectService()

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0a0a0b',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 18, y: 20 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendToRenderer(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload)
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.prebase.app')
  }

  ipcMain.handle('project:open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Open Project'
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('project:open', async (_, projectPath: string) => {
    try {
      const snapshot = await projectService.openProject(projectPath, (payload, full) => {
        if (full) {
          sendToRenderer('graph:full', payload as GraphSnapshot)
        } else {
          sendToRenderer('graph:incremental', payload as IncrementalUpdate)
        }
      })
      return { success: true, snapshot }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to open project'
      }
    }
  })

  ipcMain.handle('project:close', () => {
    projectService.closeProject()
    return { success: true }
  })

  ipcMain.handle('project:get-snapshot', () => {
    return projectService.getSnapshot()
  })

  ipcMain.handle(
    'graph:relayout',
    async (
      _,
      mode: LayoutMode,
      runtime?: import('../core/layout/layout-config').LayoutRuntimeConfig,
      options?: { broadcast?: boolean }
    ) => {
      const snapshot = await projectService.relayout(mode, runtime, options)
      return snapshot
    }
  )

  ipcMain.handle('shell:show-item-in-folder', async (_, targetPath: string) => {
    if (!targetPath?.trim()) {
      return { success: false, error: 'No path provided' }
    }
    if (!existsSync(targetPath)) {
      return { success: false, error: 'Project folder not found' }
    }
    shell.showItemInFolder(targetPath)
    return { success: true }
  })

  ipcMain.handle('file:read', async (_, filePath: string) => {
    const snapshot = projectService.getSnapshot()
    if (!snapshot || !filePath) return null
    try {
      const fullPath = resolveProjectFilePath(snapshot.projectPath, filePath)
      if (!fullPath) {
        console.warn('[file:read] unresolved path:', filePath, 'project:', snapshot.projectPath)
        return null
      }
      return await readFile(fullPath, 'utf-8')
    } catch (err) {
      console.warn('[file:read] failed:', filePath, err)
      return null
    }
  })

  ipcMain.handle('ai:gemini-available', () => isGeminiAvailable())

  ipcMain.handle('ai:describe-file', async (_, params: DescribeFileParams) => {
    try {
      return await describeFile(params)
    } catch (err) {
      console.warn('[ai:describe-file] error:', err)
      return ''
    }
  })

  ipcMain.handle('ai:describe-layer', async (_, params: DescribeLayerParams) => {
    try {
      return await describeLayer(params)
    } catch (err) {
      console.warn('[ai:describe-layer] error:', err)
      return ''
    }
  })

  ipcMain.handle('ai:magnus-chat', async (_, params: MagnusChatParams) => {
    try {
      return await magnusChat(params)
    } catch (err) {
      console.warn('[ai:magnus-chat] error:', err)
      return 'Error communicating with Magnus. Please try again.'
    }
  })

  ipcMain.handle('ai:gemini-ping', async () => {
    return await geminiPing()
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  projectService.closeProject()
  if (process.platform !== 'darwin') app.quit()
})
