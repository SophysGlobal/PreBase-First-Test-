import { create } from 'zustand'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode } from '../../../core/types'

export type FilterKind = 'all' | 'files' | 'components' | 'imports' | 'folders'
export type ViewMode = 'code' | 'graph'

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
  secondarySidebarCollapsed: boolean
  showMinimap: boolean
  showFolders: boolean
  showLegend: boolean
  legendCollapsed: boolean
  inspectorOpen: boolean
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
  toggleSecondarySidebar: () => void
  setShowMinimap: (show: boolean) => void
  setShowFolders: (show: boolean) => void
  setShowLegend: (show: boolean) => void
  setLegendCollapsed: (collapsed: boolean) => void
  setInspectorOpen: (open: boolean) => void
  updateUserPosition: (nodeId: string, position: { x: number; y: number }) => void
  setInitialCameraDone: (done: boolean) => void
  reset: () => void
}

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
  secondarySidebarCollapsed: false,
  showMinimap: true,
  showFolders: false,
  showLegend: true,
  legendCollapsed: false,
  inspectorOpen: true,
  userPositions: {},
  initialCameraDone: false,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSnapshot: (snapshot) =>
    set({
      snapshot,
      isLoading: false,
      error: null,
      userPositions: snapshot.positions,
      initialCameraDone: false,
      focusedNodeId: snapshot.entryNodeId,
      selectedNodeId: snapshot.entryNodeId
    }),

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

    set({
      snapshot: {
        ...current,
        nodes: [...nodeMap.values()],
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
    set({ selectedNodeId, selectedEdgeId: null, inspectorOpen: true }),
  setSelectedEdgeId: (selectedEdgeId) =>
    set({ selectedEdgeId, selectedNodeId: null, inspectorOpen: true }),
  setFilter: (filter) => set({ filter }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setGraphDepth: (graphDepth) => set({ graphDepth }),
  toggleSecondarySidebar: () =>
    set((s) => ({ secondarySidebarCollapsed: !s.secondarySidebarCollapsed })),
  setShowMinimap: (showMinimap) => set({ showMinimap }),
  setShowFolders: (showFolders) => set({ showFolders }),
  setShowLegend: (showLegend) => set({ showLegend }),
  setLegendCollapsed: (legendCollapsed) => set({ legendCollapsed }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
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
      userPositions: {},
      initialCameraDone: false
    })
}))
