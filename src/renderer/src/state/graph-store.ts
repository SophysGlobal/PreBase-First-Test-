import { create } from 'zustand'
import {
  assignLayersToNodes,
  buildDefaultLayerVisibility,
  type ArchitectureLayerId
} from '../../../core/utils/architecture-layers'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode } from '../../../core/types'
import { toProjectRelativePath } from '../utils/path-utils'

export type FilterKind = 'all' | 'files' | 'components' | 'imports' | 'folders'
export type ViewMode = 'code' | 'graph' | 'settings'

interface GraphStore {
  snapshot: GraphSnapshot | null
  isLoading: boolean
  error: string | null
  viewMode: ViewMode
  searchQuery: string
  focusedNodeId: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  filter: FilterKind
  layoutMode: LayoutMode
  graphDepth: number
  layerVisibility: Record<ArchitectureLayerId, boolean>
  isolatedLayer: ArchitectureLayerId | null
  focusNeighborhood: boolean
  hideLowImportance: boolean
  secondarySidebarCollapsed: boolean
  showMinimap: boolean
  showFolders: boolean
  showLegend: boolean
  legendCollapsed: boolean
  inspectorOpen: boolean
  activeCodePath: string | null
  userPositions: Record<string, { x: number; y: number }>
  initialCameraDone: boolean

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSnapshot: (snapshot: GraphSnapshot) => void
  applyIncremental: (update: IncrementalUpdate) => void
  setViewMode: (mode: ViewMode) => void
  setSearchQuery: (query: string) => void
  setFocusedNodeId: (id: string | null) => void
  setSelectedNodeId: (id: string | null) => void
  setSelectedEdgeId: (id: string | null) => void
  setFilter: (filter: FilterKind) => void
  setLayoutMode: (mode: LayoutMode) => void
  setGraphDepth: (depth: number) => void
  setLayerVisible: (layer: ArchitectureLayerId, visible: boolean) => void
  setAllLayersVisible: (visible: boolean) => void
  setIsolatedLayer: (layer: ArchitectureLayerId | null) => void
  setFocusNeighborhood: (on: boolean) => void
  setHideLowImportance: (on: boolean) => void
  toggleSecondarySidebar: () => void
  setShowMinimap: (show: boolean) => void
  setShowFolders: (show: boolean) => void
  setShowLegend: (show: boolean) => void
  setLegendCollapsed: (collapsed: boolean) => void
  setInspectorOpen: (open: boolean) => void
  setActiveCodePath: (path: string | null) => void
  openFileInCodeView: (nodeId: string) => void
  updateUserPosition: (nodeId: string, position: { x: number; y: number }) => void
  setInitialCameraDone: (done: boolean) => void
  reset: () => void
}

const defaultLayerVisibility = buildDefaultLayerVisibility()

export const useGraphStore = create<GraphStore>((set, get) => ({
  snapshot: null,
  isLoading: false,
  error: null,
  viewMode: 'graph',
  searchQuery: '',
  focusedNodeId: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  filter: 'all',
  layoutMode: 'hierarchy',
  graphDepth: 2,
  layerVisibility: { ...defaultLayerVisibility },
  isolatedLayer: null,
  focusNeighborhood: false,
  hideLowImportance: true,
  secondarySidebarCollapsed: false,
  showMinimap: true,
  showFolders: false,
  showLegend: true,
  legendCollapsed: false,
  inspectorOpen: true,
  activeCodePath: null,
  userPositions: {},
  initialCameraDone: false,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  setSnapshot: (snapshot) => {
    const withLayers = {
      ...snapshot,
      nodes: assignLayersToNodes(snapshot.nodes, snapshot.entryNodeId)
    }
    set({
      snapshot: withLayers,
      isLoading: false,
      error: null,
      userPositions: withLayers.positions,
      initialCameraDone: false,
      focusedNodeId: withLayers.entryNodeId,
      selectedNodeId: withLayers.entryNodeId
    })
  },

  applyIncremental: (update) => {
    const current = get().snapshot
    if (!current) return

    const nodeMap = new Map(current.nodes.map((n) => [n.id, n]))
    for (const id of update.removedNodeIds) nodeMap.delete(id)
    for (const node of update.updatedNodes) nodeMap.set(node.id, node)
    for (const node of update.addedNodes) nodeMap.set(node.id, node)

    const edgeMap = new Map(current.edges.map((e) => [e.id, e]))
    for (const id of update.removedEdgeIds) edgeMap.delete(id)
    for (const edge of update.addedEdges) edgeMap.set(edge.id, edge)

    const positions = { ...current.positions, ...update.positions }
    for (const id of update.removedNodeIds) delete positions[id]

    const nodes = assignLayersToNodes([...nodeMap.values()], current.entryNodeId)

    set({
      snapshot: {
        ...current,
        nodes,
        edges: [...edgeMap.values()],
        positions,
        scannedAt: Date.now()
      },
      userPositions: { ...get().userPositions, ...update.positions }
    })
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFocusedNodeId: (focusedNodeId) => set({ focusedNodeId }),
  setSelectedNodeId: (selectedNodeId) =>
    set({
      selectedNodeId,
      selectedEdgeId: null,
      inspectorOpen: selectedNodeId !== null
    }),
  setSelectedEdgeId: (selectedEdgeId) =>
    set({ selectedEdgeId, selectedNodeId: null, inspectorOpen: true }),
  setFilter: (filter) => set({ filter }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setGraphDepth: (graphDepth) => set({ graphDepth }),
  setLayerVisible: (layer, visible) =>
    set((s) => ({
      layerVisibility: { ...s.layerVisibility, [layer]: visible },
      isolatedLayer: s.isolatedLayer === layer && !visible ? null : s.isolatedLayer
    })),
  setAllLayersVisible: (visible) =>
    set((s) => {
      const layerVisibility = { ...s.layerVisibility }
      for (const key of Object.keys(layerVisibility) as ArchitectureLayerId[]) {
        if (key === 'entry') {
          layerVisibility.entry = true
          continue
        }
        layerVisibility[key] = visible
      }
      return { layerVisibility, isolatedLayer: visible ? s.isolatedLayer : null }
    }),
  setIsolatedLayer: (isolatedLayer) => set({ isolatedLayer }),
  setFocusNeighborhood: (focusNeighborhood) => set({ focusNeighborhood }),
  setHideLowImportance: (hideLowImportance) => set({ hideLowImportance }),
  toggleSecondarySidebar: () =>
    set((s) => ({ secondarySidebarCollapsed: !s.secondarySidebarCollapsed })),
  setShowMinimap: (showMinimap) => set({ showMinimap }),
  setShowFolders: (showFolders) => set({ showFolders }),
  setShowLegend: (showLegend) => set({ showLegend }),
  setLegendCollapsed: (legendCollapsed) => set({ legendCollapsed }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setActiveCodePath: (activeCodePath) => set({ activeCodePath }),
  openFileInCodeView: (nodeId) => {
    const snap = get().snapshot
    if (!snap) return
    const node = snap.nodes.find((n) => n.id === nodeId)
    if (!node?.path || (node.kind !== 'file' && node.kind !== 'component')) return
    const rel = toProjectRelativePath(snap.projectPath, node.path)
    if (!rel) return
    set({
      viewMode: 'code',
      activeCodePath: rel,
      selectedNodeId: nodeId,
      focusedNodeId: nodeId,
      inspectorOpen: true
    })
  },
  updateUserPosition: (nodeId, position) =>
    set((s) => ({
      userPositions: { ...s.userPositions, [nodeId]: position }
    })),
  setInitialCameraDone: (initialCameraDone) => set({ initialCameraDone }),
  reset: () =>
    set({
      snapshot: null,
      isLoading: false,
      error: null,
      searchQuery: '',
      focusedNodeId: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      activeCodePath: null,
      userPositions: {},
      initialCameraDone: false,
      layerVisibility: { ...defaultLayerVisibility },
      isolatedLayer: null,
      focusNeighborhood: false
    })
}))
