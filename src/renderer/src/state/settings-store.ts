import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutMode } from '../../../core/types'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type UiDensity = 'comfortable' | 'compact'
export type GraphQuality = 'balanced' | 'performance'

export interface AppSettings {
  theme: ThemePreference
  uiDensity: UiDensity
  reduceMotion: boolean
  defaultLayout: LayoutMode
  showEdgeLabels: boolean
  showHierarchyLabels: boolean
  initialZoom: number
  nodeDragDelayMs: number
  editorFontSize: number
  editorLineNumbers: boolean
  editorWordWrap: boolean
  editorMinimap: boolean
  panSensitivity: number
  zoomSensitivity: number
  graphQuality: GraphQuality
}

interface SettingsStore extends AppSettings {
  setTheme: (theme: ThemePreference) => void
  setUiDensity: (density: UiDensity) => void
  setReduceMotion: (on: boolean) => void
  setDefaultLayout: (mode: LayoutMode) => void
  setShowEdgeLabels: (on: boolean) => void
  setShowHierarchyLabels: (on: boolean) => void
  setInitialZoom: (zoom: number) => void
  setNodeDragDelayMs: (ms: number) => void
  setEditorFontSize: (size: number) => void
  setEditorLineNumbers: (on: boolean) => void
  setEditorWordWrap: (on: boolean) => void
  setEditorMinimap: (on: boolean) => void
  setPanSensitivity: (value: number) => void
  setZoomSensitivity: (value: number) => void
  setGraphQuality: (quality: GraphQuality) => void
  resetSettings: () => void
}

const defaults: AppSettings = {
  theme: 'dark',
  uiDensity: 'comfortable',
  reduceMotion: false,
  defaultLayout: 'hierarchy',
  showEdgeLabels: false,
  showHierarchyLabels: true,
  initialZoom: 0.92,
  nodeDragDelayMs: 200,
  editorFontSize: 13,
  editorLineNumbers: true,
  editorWordWrap: false,
  editorMinimap: true,
  panSensitivity: 1,
  zoomSensitivity: 1,
  graphQuality: 'balanced'
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setUiDensity: (uiDensity) => set({ uiDensity }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setDefaultLayout: (defaultLayout) => set({ defaultLayout }),
      setShowEdgeLabels: (showEdgeLabels) => set({ showEdgeLabels }),
      setShowHierarchyLabels: (showHierarchyLabels) => set({ showHierarchyLabels }),
      setInitialZoom: (initialZoom) => set({ initialZoom }),
      setNodeDragDelayMs: (nodeDragDelayMs) => set({ nodeDragDelayMs }),
      setEditorFontSize: (editorFontSize) => set({ editorFontSize }),
      setEditorLineNumbers: (editorLineNumbers) => set({ editorLineNumbers }),
      setEditorWordWrap: (editorWordWrap) => set({ editorWordWrap }),
      setEditorMinimap: (editorMinimap) => set({ editorMinimap }),
      setPanSensitivity: (panSensitivity) => set({ panSensitivity }),
      setZoomSensitivity: (zoomSensitivity) => set({ zoomSensitivity }),
      setGraphQuality: (graphQuality) => set({ graphQuality }),
      resetSettings: () => set({ ...defaults })
    }),
    {
      name: 'prebase-settings-v2',
      migrate: (persisted) => {
        const state = { ...defaults, ...(persisted as Partial<AppSettings>) }
        const valid: LayoutMode[] = ['hierarchy', 'pyramid', 'scattered']
        if (!valid.includes(state.defaultLayout)) {
          state.defaultLayout = 'hierarchy'
        }
        if (state.showHierarchyLabels === undefined) state.showHierarchyLabels = true
        if (state.nodeDragDelayMs === undefined) state.nodeDragDelayMs = 200
        if (state.editorMinimap === undefined) state.editorMinimap = true
        if (state.graphQuality === undefined) state.graphQuality = 'balanced'
        return state
      }
    }
  )
)

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return preference
}
