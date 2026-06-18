import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutMode } from '../../../core/types'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type UiDensity = 'comfortable' | 'compact'
export type GraphQuality = 'balanced' | 'performance'
export type EditorWhitespace = 'none' | 'boundary' | 'selection' | 'all'
export type LayoutSpacing = 'compact' | 'balanced' | 'spacious'
export type LayoutOrganizationMethod =
  | 'dependency-depth'
  | 'import-importance'
  | 'file-role'
  | 'directory-proximity'

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
  // Graph — advanced
  layoutAnimationDuration: number
  layerRadiusScale: number
  maxNodesPerLayer: number
  layerGap: number
  centerClearance: number
  scatterRelaxIterations: number
  /** Architecture graph node spacing preset. */
  layoutSpacing: LayoutSpacing
  /** How hierarchy/pyramid tiers are ranked. */
  layoutOrganizationMethod: LayoutOrganizationMethod
  folderExpansionRadius: number
  edgeSimplificationThreshold: number
  /** Additional import edges per file beyond root connection (max 2). */
  visibleRelatedConnections: 0 | 1 | 2
  // Editor — advanced
  editorBracketPairColorization: boolean
  editorRenderWhitespace: EditorWhitespace
  editorScrollBeyondLastLine: boolean
  editorCursorSmoothCaret: boolean
  // Performance — advanced
  renderThrottlingMs: number
  maxRenderedNodes: number
  // Sidebar layout
  secondarySidebarWidth: number
  secondarySidebarCollapsedWidth: number
  inspectorPanelWidth: number
  sidebarMinWidth: number
  sidebarMaxWidth: number
  // Network graph — advanced
  networkSimulationTicks: number
  networkLodNodeThreshold: number
  networkPhysicsStrength: number
  networkEdgeOpacity: number
  /** Network graph empty-space rotation direction. */
  networkDragDirection: 'natural' | 'inverted'
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
  setLayoutAnimationDuration: (ms: number) => void
  setLayerRadiusScale: (value: number) => void
  setMaxNodesPerLayer: (value: number) => void
  setLayerGap: (value: number) => void
  setCenterClearance: (value: number) => void
  setLayoutSpacing: (spacing: LayoutSpacing) => void
  setLayoutOrganizationMethod: (method: LayoutOrganizationMethod) => void
  setScatterRelaxIterations: (value: number) => void
  setFolderExpansionRadius: (value: number) => void
  setEdgeSimplificationThreshold: (value: number) => void
  setVisibleRelatedConnections: (value: 0 | 1 | 2) => void
  setEditorBracketPairColorization: (on: boolean) => void
  setEditorRenderWhitespace: (mode: EditorWhitespace) => void
  setEditorScrollBeyondLastLine: (on: boolean) => void
  setEditorCursorSmoothCaret: (on: boolean) => void
  setRenderThrottlingMs: (ms: number) => void
  setMaxRenderedNodes: (value: number) => void
  setSecondarySidebarWidth: (value: number) => void
  setSecondarySidebarCollapsedWidth: (value: number) => void
  setInspectorPanelWidth: (value: number) => void
  setSidebarMinWidth: (value: number) => void
  setSidebarMaxWidth: (value: number) => void
  setNetworkSimulationTicks: (value: number) => void
  setNetworkLodNodeThreshold: (value: number) => void
  setNetworkPhysicsStrength: (value: number) => void
  setNetworkEdgeOpacity: (value: number) => void
  setNetworkDragDirection: (value: 'natural' | 'inverted') => void
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
  graphQuality: 'balanced',
  layoutAnimationDuration: 750,
  layerRadiusScale: 1,
  maxNodesPerLayer: 24,
  layerGap: 132,
  centerClearance: 108,
  scatterRelaxIterations: 10,
  layoutSpacing: 'balanced',
  layoutOrganizationMethod: 'dependency-depth',
  folderExpansionRadius: 82,
  edgeSimplificationThreshold: 0,
  visibleRelatedConnections: 2,
  editorBracketPairColorization: true,
  editorRenderWhitespace: 'none',
  editorScrollBeyondLastLine: false,
  editorCursorSmoothCaret: true,
  renderThrottlingMs: 0,
  maxRenderedNodes: 0,
  secondarySidebarWidth: 260,
  secondarySidebarCollapsedWidth: 36,
  inspectorPanelWidth: 240,
  sidebarMinWidth: 200,
  sidebarMaxWidth: 420,
  networkSimulationTicks: 80,
  networkLodNodeThreshold: 900,
  networkPhysicsStrength: 1,
  networkEdgeOpacity: 0.55,
  networkDragDirection: 'natural'
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
      setLayoutAnimationDuration: (layoutAnimationDuration) => set({ layoutAnimationDuration }),
      setLayerRadiusScale: (layerRadiusScale) => set({ layerRadiusScale }),
      setMaxNodesPerLayer: (maxNodesPerLayer) => set({ maxNodesPerLayer }),
      setLayerGap: (layerGap) => set({ layerGap }),
      setCenterClearance: (centerClearance) => set({ centerClearance }),
      setScatterRelaxIterations: (scatterRelaxIterations) => set({ scatterRelaxIterations }),
      setLayoutSpacing: (layoutSpacing) => set({ layoutSpacing }),
      setLayoutOrganizationMethod: (layoutOrganizationMethod) => set({ layoutOrganizationMethod }),
      setFolderExpansionRadius: (folderExpansionRadius) => set({ folderExpansionRadius }),
      setEdgeSimplificationThreshold: (edgeSimplificationThreshold) =>
        set({ edgeSimplificationThreshold }),
      setVisibleRelatedConnections: (visibleRelatedConnections) =>
        set({ visibleRelatedConnections }),
      setEditorBracketPairColorization: (editorBracketPairColorization) =>
        set({ editorBracketPairColorization }),
      setEditorRenderWhitespace: (editorRenderWhitespace) => set({ editorRenderWhitespace }),
      setEditorScrollBeyondLastLine: (editorScrollBeyondLastLine) =>
        set({ editorScrollBeyondLastLine }),
      setEditorCursorSmoothCaret: (editorCursorSmoothCaret) => set({ editorCursorSmoothCaret }),
      setRenderThrottlingMs: (renderThrottlingMs) => set({ renderThrottlingMs }),
      setMaxRenderedNodes: (maxRenderedNodes) => set({ maxRenderedNodes }),
      setSecondarySidebarWidth: (secondarySidebarWidth) => set({ secondarySidebarWidth }),
      setSecondarySidebarCollapsedWidth: (secondarySidebarCollapsedWidth) =>
        set({ secondarySidebarCollapsedWidth }),
      setInspectorPanelWidth: (inspectorPanelWidth) => set({ inspectorPanelWidth }),
      setSidebarMinWidth: (sidebarMinWidth) => set({ sidebarMinWidth }),
      setSidebarMaxWidth: (sidebarMaxWidth) => set({ sidebarMaxWidth }),
      setNetworkSimulationTicks: (networkSimulationTicks) => set({ networkSimulationTicks }),
      setNetworkLodNodeThreshold: (networkLodNodeThreshold) => set({ networkLodNodeThreshold }),
      setNetworkPhysicsStrength: (networkPhysicsStrength) => set({ networkPhysicsStrength }),
      setNetworkEdgeOpacity: (networkEdgeOpacity) => set({ networkEdgeOpacity }),
      setNetworkDragDirection: (networkDragDirection) => set({ networkDragDirection }),
      resetSettings: () => set({ ...defaults })
    }),
    {
      name: 'prebase-settings-v8',
      migrate: (persisted) => {
        const state = { ...defaults, ...(persisted as Partial<AppSettings>) }
        // P0 fix: edge simplification hid all import edges for many users
        state.edgeSimplificationThreshold = 0
        const valid: LayoutMode[] = ['hierarchy', 'pyramid', 'scattered']
        if (!valid.includes(state.defaultLayout)) {
          state.defaultLayout = 'hierarchy'
        }
        if (state.showHierarchyLabels === undefined) state.showHierarchyLabels = true
        const orgMethods: LayoutOrganizationMethod[] = [
          'dependency-depth',
          'import-importance',
          'file-role',
          'directory-proximity'
        ]
        if (!orgMethods.includes(state.layoutOrganizationMethod)) {
          state.layoutOrganizationMethod = 'dependency-depth'
        }
        if (state.nodeDragDelayMs === undefined) state.nodeDragDelayMs = 200
        if (state.editorMinimap === undefined) state.editorMinimap = true
        if (state.graphQuality === undefined) state.graphQuality = 'balanced'
        if (state.layoutAnimationDuration === undefined) state.layoutAnimationDuration = 750
        if (state.layerRadiusScale === undefined) state.layerRadiusScale = 1
        if (state.maxNodesPerLayer === undefined) state.maxNodesPerLayer = 24
        if (state.layerGap === undefined) state.layerGap = 132
        if (state.centerClearance === undefined) state.centerClearance = 108
        if (state.scatterRelaxIterations === undefined) state.scatterRelaxIterations = 10
        if (state.folderExpansionRadius === undefined) state.folderExpansionRadius = 82
        if (state.edgeSimplificationThreshold === undefined) {
          state.edgeSimplificationThreshold = 0
        }
        if (state.visibleRelatedConnections === undefined) {
          state.visibleRelatedConnections = 2
        } else {
          const v = state.visibleRelatedConnections
          if (v < 0 || v > 2) state.visibleRelatedConnections = 2
        }
        if (state.editorBracketPairColorization === undefined) {
          state.editorBracketPairColorization = true
        }
        if (state.editorRenderWhitespace === undefined) state.editorRenderWhitespace = 'none'
        if (state.editorScrollBeyondLastLine === undefined) {
          state.editorScrollBeyondLastLine = false
        }
        if (state.editorCursorSmoothCaret === undefined) state.editorCursorSmoothCaret = true
        if (state.renderThrottlingMs === undefined) state.renderThrottlingMs = 0
        if (state.maxRenderedNodes === undefined) state.maxRenderedNodes = 0
        if (state.secondarySidebarWidth === undefined) state.secondarySidebarWidth = 260
        if (state.secondarySidebarCollapsedWidth === undefined) {
          state.secondarySidebarCollapsedWidth = 36
        }
        if (state.inspectorPanelWidth === undefined) state.inspectorPanelWidth = 240
        if (state.sidebarMinWidth === undefined) state.sidebarMinWidth = 200
        if (state.sidebarMaxWidth === undefined) state.sidebarMaxWidth = 420
        if (state.networkSimulationTicks === undefined) state.networkSimulationTicks = 80
        if (state.networkLodNodeThreshold === undefined) state.networkLodNodeThreshold = 900
        if (state.networkPhysicsStrength === undefined) state.networkPhysicsStrength = 1
        if (state.networkEdgeOpacity === undefined) state.networkEdgeOpacity = 0.55
        if (state.networkDragDirection === undefined) state.networkDragDirection = 'natural'
        if (state.layoutSpacing === undefined) state.layoutSpacing = 'balanced'
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
