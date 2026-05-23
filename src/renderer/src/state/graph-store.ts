import { create } from 'zustand'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode } from '../../../core/types'

export type FilterKind = 'all' | 'files' | 'components' | 'imports' | 'folders'

interface GraphStore {
  snapshot: GraphSnapshot | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  focusedNodeId: string | null
  filter: FilterKind
  layoutMode: LayoutMode
  sidebarCollapsed: boolean
  showMinimap: boolean
  showFolders: boolean
  userPositions: Record<string, { x: number; y: number }>

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSnapshot: (snapshot: GraphSnapshot) => void
  applyIncremental: (update: IncrementalUpdate) => void
  setSearchQuery: (query: string) => void
  setFocusedNodeId: (id: string | null) => void
  setFilter: (filter: FilterKind) => void
  setLayoutMode: (mode: LayoutMode) => void
  toggleSidebar: () => void
  setShowMinimap: (show: boolean) => void
  setShowFolders: (show: boolean) => void
  updateUserPosition: (nodeId: string, position: { x: number; y: number }) => void
  reset: () => void
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  snapshot: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  focusedNodeId: null,
  filter: 'all',
  layoutMode: 'layered',
  sidebarCollapsed: false,
  showMinimap: true,
  showFolders: false,
  userPositions: {},

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSnapshot: (snapshot) =>
    set({
      snapshot,
      isLoading: false,
      error: null,
      userPositions: snapshot.positions
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

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFocusedNodeId: (focusedNodeId) => set({ focusedNodeId }),
  setFilter: (filter) => set({ filter }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setShowMinimap: (showMinimap) => set({ showMinimap }),
  setShowFolders: (showFolders) => set({ showFolders }),
  updateUserPosition: (nodeId, position) =>
    set((s) => ({
      userPositions: { ...s.userPositions, [nodeId]: position }
    })),
  reset: () =>
    set({
      snapshot: null,
      isLoading: false,
      error: null,
      searchQuery: '',
      focusedNodeId: null,
      userPositions: {}
    })
}))
