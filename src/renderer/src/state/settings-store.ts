import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutMode } from '../../../core/types'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type UiDensity = 'comfortable' | 'compact'

export interface AppSettings {
  theme: ThemePreference
  uiDensity: UiDensity
  reduceMotion: boolean
  defaultLayout: LayoutMode
  showEdgeLabels: boolean
  initialZoom: number
  editorFontSize: number
  editorLineNumbers: boolean
  editorWordWrap: boolean
  panSensitivity: number
  zoomSensitivity: number
}

interface SettingsStore extends AppSettings {
  setTheme: (theme: ThemePreference) => void
  setUiDensity: (density: UiDensity) => void
  setReduceMotion: (on: boolean) => void
  setDefaultLayout: (mode: LayoutMode) => void
  setShowEdgeLabels: (on: boolean) => void
  setInitialZoom: (zoom: number) => void
  setEditorFontSize: (size: number) => void
  setEditorLineNumbers: (on: boolean) => void
  setEditorWordWrap: (on: boolean) => void
  setPanSensitivity: (value: number) => void
  setZoomSensitivity: (value: number) => void
  resetSettings: () => void
}

const defaults: AppSettings = {
  theme: 'dark',
  uiDensity: 'comfortable',
  reduceMotion: false,
  defaultLayout: 'hierarchy',
  showEdgeLabels: false,
  initialZoom: 0.92,
  editorFontSize: 13,
  editorLineNumbers: true,
  editorWordWrap: false,
  panSensitivity: 1,
  zoomSensitivity: 1
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
      setInitialZoom: (initialZoom) => set({ initialZoom }),
      setEditorFontSize: (editorFontSize) => set({ editorFontSize }),
      setEditorLineNumbers: (editorLineNumbers) => set({ editorLineNumbers }),
      setEditorWordWrap: (editorWordWrap) => set({ editorWordWrap }),
      setPanSensitivity: (panSensitivity) => set({ panSensitivity }),
      setZoomSensitivity: (zoomSensitivity) => set({ zoomSensitivity }),
      resetSettings: () => set({ ...defaults })
    }),
    { name: 'prebase-settings-v1' }
  )
)

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return preference
}
