import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type OnNodesChange,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ArchitectureNode } from '../nodes/ArchitectureNode'
import { ArchitectureEdge } from '../edges/ArchitectureEdge'
import { ArchitectureGraphLegend } from './GraphLegendBar'
import { ArchitectureOverview } from './ArchitectureOverview'
import { GraphMinimap } from './GraphMinimap'
import { HierarchyLabels } from './HierarchyLabels'
import { NodeInspector } from '../inspector/NodeInspector'
import { AiChatBubble } from '../ai/AiChatBubble'
import { NodeContextMenu } from './NodeContextMenu'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { viewportFitForLayout } from '@core/layout/layout-constraints'
import { getRenderableNodeIds, toFlowEdges, toFlowNodes } from '../../utils/flow-adapter'
import { debugArchRender, debugTilePressure } from '../../utils/graph-debug'

const nodeTypes = { architecture: ArchitectureNode }
const edgeTypes = { architecture: ArchitectureEdge }

function InitialViewportController() {
  const { fitView, getNodes } = useReactFlow()
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const initialCameraDone = useGraphStore((s) => s.initialCameraDone)
  const setInitialCameraDone = useGraphStore((s) => s.setInitialCameraDone)
  const initialZoom = useSettingsStore((s) => s.initialZoom)
  const layoutAnimationDuration = useSettingsStore((s) => s.layoutAnimationDuration)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)

  useEffect(() => {
    if (!snapshot || initialCameraDone) return

    const fit = viewportFitForLayout(layoutMode)
    const t = setTimeout(() => {
      const nodes = getNodes()
      if (nodes.length === 0) {
        setInitialCameraDone(true)
        return
      }

      void fitView({
        nodes,
        padding: fit.padding,
        minZoom: fit.minZoom,
        maxZoom: Math.min(fit.maxZoom, Math.max(0.82, initialZoom)),
        duration: reduceMotion ? 0 : layoutAnimationDuration
      })
      setInitialCameraDone(true)
    }, 180)

    return () => clearTimeout(t)
  }, [
    snapshot,
    layoutMode,
    initialCameraDone,
    getNodes,
    fitView,
    setInitialCameraDone,
    initialZoom,
    layoutAnimationDuration,
    reduceMotion
  ])

  return null
}

function LayoutViewportController() {
  const { fitView, getNodes } = useReactFlow()
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const architectureMode = useGraphStore((s) => s.architectureMode)
  const initialCameraDone = useGraphStore((s) => s.initialCameraDone)
  const initialZoom = useSettingsStore((s) => s.initialZoom)
  const layoutAnimationDuration = useSettingsStore((s) => s.layoutAnimationDuration)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const prevLayout = useRef(layoutMode)
  const prevMode = useRef(architectureMode)

  useEffect(() => {
    if (!initialCameraDone) return
    // Refit when either the layout preset OR the architecture-mode slice changes,
    // since the focused slice can be a small fraction of the project.
    if (prevLayout.current === layoutMode && prevMode.current === architectureMode) return
    prevLayout.current = layoutMode
    prevMode.current = architectureMode

    const fit = viewportFitForLayout(layoutMode)
    const t = setTimeout(() => {
      const nodes = getNodes()
      if (nodes.length === 0) return
      void fitView({
        nodes,
        padding: fit.padding,
        minZoom: fit.minZoom,
        maxZoom: Math.min(fit.maxZoom, Math.max(0.82, initialZoom)),
        duration: reduceMotion ? 0 : Math.min(layoutAnimationDuration, 500)
      })
    }, 120)
    return () => clearTimeout(t)
  }, [
    layoutMode,
    architectureMode,
    initialCameraDone,
    getNodes,
    fitView,
    initialZoom,
    layoutAnimationDuration,
    reduceMotion
  ])

  return null
}

function FocusCameraController() {
  const { setCenter, getNode } = useReactFlow()
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const initialCameraDone = useGraphStore((s) => s.initialCameraDone)
  const prevFocus = useRef<string | null>(null)

  useEffect(() => {
    if (!initialCameraDone) return
    const target = focusedNodeId ?? selectedNodeId
    if (!target || target === prevFocus.current) return
    prevFocus.current = target

    const node = getNode(target)
    if (!node) return

    const t = setTimeout(() => {
      void setCenter(node.position.x + 84, node.position.y + 26, {
        zoom: 1.02,
        duration: 550
      })
    }, 40)
    return () => clearTimeout(t)
  }, [focusedNodeId, selectedNodeId, initialCameraDone, getNode, setCenter])

  return null
}

export function GraphCanvas() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const filter = useGraphStore((s) => s.filter)
  const graphOrganizationMode = useGraphStore((s) => s.graphOrganizationMode)
  const architectureMode = useGraphStore((s) => s.architectureMode)
  const graphDepth = useGraphStore((s) => s.graphDepth)
  const layerVisibility = useGraphStore((s) => s.layerVisibility)
  const isolatedLayer = useGraphStore((s) => s.isolatedLayer)
  const focusNeighborhood = useGraphStore((s) => s.focusNeighborhood)
  const hideLowImportance = useGraphStore((s) => s.hideLowImportance)
  const userPositions = useGraphStore((s) => s.userPositions)
  const expandedFolderIds = useGraphStore((s) => s.expandedFolderIds)
  const updateUserPosition = useGraphStore((s) => s.updateUserPosition)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const setInspectorOpen = useGraphStore((s) => s.setInspectorOpen)
  const toggleFolderExpand = useGraphStore((s) => s.toggleFolderExpand)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(
    null
  )
  const panSensitivity = useSettingsStore((s) => s.panSensitivity)
  const nodeDragDelayMs = useSettingsStore((s) => s.nodeDragDelayMs)
  const showEdgeLabels = useSettingsStore((s) => s.showEdgeLabels)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const graphQuality = useSettingsStore((s) => s.graphQuality)
  const edgeSimplificationThreshold = useSettingsStore((s) => s.edgeSimplificationThreshold)
  const visibleRelatedConnections = useSettingsStore((s) => s.visibleRelatedConnections)
  const folderExpansionRadius = useSettingsStore((s) => s.folderExpansionRadius)
  const maxRenderedNodes = useSettingsStore((s) => s.maxRenderedNodes)
  const renderThrottlingMs = useSettingsStore((s) => s.renderThrottlingMs)

  const [dragReadyNodeId, setDragReadyNodeId] = useState<string | null>(null)
  const [viewportMoving, setViewportMoving] = useState(false)
  const viewportMovingRef = useRef(false)
  const zoomEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current)
    },
    []
  )

  const dimOnSearch = searchQuery.trim().length > 0
  const nodeCount = snapshot?.nodes.length ?? 0
  const hugeProject = nodeCount > 900
  const performanceMode =
    graphQuality === 'performance' || reduceMotion || hugeProject
  const effectiveRenderThrottle =
    hugeProject && renderThrottlingMs < 24 ? 24 : renderThrottlingMs
  const edgeDebugMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('edgeDebug') === '1' ||
      window.localStorage.getItem('prebase:edge-debug') === '1')
  const edgeDiagnosticsEnabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('edgeDiag') === '1' ||
      window.localStorage.getItem('prebase:edge-diagnostics') === '1')

  const dragEnabledNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (dragReadyNodeId) ids.add(dragReadyNodeId)
    if (selectedNodeId) ids.add(selectedNodeId)
    return ids
  }, [dragReadyNodeId, selectedNodeId])

  // NOTE: `dragEnabledNodeIds` is intentionally NOT a dependency here. Hover-driven
  // drag-readiness must not regenerate the whole flow model every mouse move (that
  // caused the architecture-graph flicker). `canDrag` is synced separately, in place,
  // by the lightweight effect below.
  const EMPTY_DRAG_IDS = useMemo(() => new Set<string>(), [])

  const flowNodes = useMemo(() => {
    if (!snapshot) return []
    return toFlowNodes(snapshot, {
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      graphOrganizationMode,
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood,
      hideLowImportance,
      userPositions,
      dimOnSearch,
      expandedFolderIds,
      dragEnabledNodeIds: EMPTY_DRAG_IDS,
      showEdgeLabels,
      reduceAnimations: performanceMode,
      edgeDebugMode,
      visibleRelatedConnections,
      edgeSimplificationThreshold,
      folderExpansionRadius,
      maxRenderedNodes,
      architectureMode
    })
  }, [
    snapshot,
    searchQuery,
    focusedNodeId,
    selectedNodeId,
    filter,
    graphOrganizationMode,
    architectureMode,
    graphDepth,
    layerVisibility,
    isolatedLayer,
    focusNeighborhood,
    hideLowImportance,
    userPositions,
    dimOnSearch,
    expandedFolderIds,
    EMPTY_DRAG_IDS,
    showEdgeLabels,
    performanceMode,
    edgeDebugMode,
    visibleRelatedConnections,
    edgeSimplificationThreshold,
    folderExpansionRadius,
    maxRenderedNodes
  ])

  const flowOpts = useMemo(
    () => ({
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      graphOrganizationMode,
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood,
      hideLowImportance,
      userPositions,
      expandedFolderIds,
      dragEnabledNodeIds: EMPTY_DRAG_IDS,
      showEdgeLabels,
      reduceAnimations: performanceMode,
      edgeDebugMode,
      visibleRelatedConnections,
      edgeSimplificationThreshold,
      folderExpansionRadius,
      maxRenderedNodes,
      architectureMode
    }),
    [
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      graphOrganizationMode,
      architectureMode,
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood,
      hideLowImportance,
      userPositions,
      expandedFolderIds,
      EMPTY_DRAG_IDS,
      showEdgeLabels,
      performanceMode,
      edgeDebugMode,
      visibleRelatedConnections,
      edgeSimplificationThreshold,
      folderExpansionRadius,
      maxRenderedNodes
    ]
  )

  const renderableNodeIds = useMemo(() => {
    if (!snapshot) return new Set<string>()
    return getRenderableNodeIds(snapshot, {
      ...flowOpts,
      dimOnSearch: dimOnSearch
    })
  }, [snapshot, flowOpts, dimOnSearch])

  const flowEdges = useMemo(() => {
    if (!snapshot) return []
    return toFlowEdges(snapshot, { ...flowOpts, selectedEdgeId: null, renderableNodeIds })
  }, [snapshot, flowOpts, renderableNodeIds])

  useEffect(() => {
    if (!edgeDiagnosticsEnabled || !snapshot) return
    const totalImports = snapshot.edges.filter((e) => e.kind === 'import').length
    const totalContains = snapshot.edges.filter((e) => e.kind === 'contains').length
    const totalDeps = snapshot.edges.filter((e) => e.kind === 'dependency').length
    console.info('[EdgeDiag] Stage 4 snapshot edges', {
      total: snapshot.edges.length,
      import: totalImports,
      contains: totalContains,
      dependency: totalDeps
    })
    console.info('[EdgeDiag] Stage 5 ReactFlow nodes/edges', {
      nodes: flowNodes.length,
      renderableNodeIds: renderableNodeIds.size,
      edges: flowEdges.length,
      edgeDebugMode
    })
  }, [edgeDiagnosticsEnabled, snapshot, flowNodes.length, renderableNodeIds.size, flowEdges.length, edgeDebugMode])

  useEffect(() => {
    debugArchRender('flow-sync', {
      nodes: flowNodes.length,
      edges: flowEdges.length,
      viewportMoving
    })
  }, [flowNodes.length, flowEdges.length, viewportMoving])

  const markViewportMoving = useCallback(() => {
    if (!viewportMovingRef.current) {
      viewportMovingRef.current = true
      setViewportMoving(true)
      debugArchRender('zoom-start')
    }
    debugTilePressure('arch-zoom', {
      nodes: flowNodes.length,
      edges: flowEdges.length,
      viewportMoving: true
    })
    if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current)
    zoomEndTimerRef.current = setTimeout(() => {
      viewportMovingRef.current = false
      setViewportMoving(false)
      debugArchRender('zoom-end')
    }, 150)
  }, [flowNodes.length, flowEdges.length])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => {
    const apply = () => {
      setNodes(flowNodes)
      setEdges(flowEdges)
    }
    if (effectiveRenderThrottle <= 0) {
      apply()
      return
    }
    const t = setTimeout(apply, effectiveRenderThrottle)
    return () => clearTimeout(t)
  }, [flowNodes, flowEdges, setNodes, setEdges, effectiveRenderThrottle])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateUserPosition(change.id, change.position)
        }
      }
    },
    [onNodesChange, updateUserPosition]
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const kind = (node.data as { kind?: string })?.kind
      if (kind === 'folder') {
        if (selectedNodeId === node.id) {
          toggleFolderExpand(node.id)
        } else {
          setSelectedNodeId(node.id)
          setFocusedNodeId(node.id)
          setInspectorOpen(true)
        }
        return
      }
      // Deterministic toggle: clicking the selected file again deselects it.
      if (selectedNodeId === node.id) {
        setSelectedNodeId(null)
        setFocusedNodeId(null)
        return
      }
      setSelectedNodeId(node.id)
      setFocusedNodeId(node.id)
      setInspectorOpen(true)
    },
    [
      selectedNodeId,
      toggleFolderExpand,
      setSelectedNodeId,
      setFocusedNodeId,
      setInspectorOpen
    ]
  )

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      setSelectedNodeId(node.id)
      setFocusedNodeId(node.id)
      setInspectorOpen(true)
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
    },
    [setSelectedNodeId, setFocusedNodeId, setInspectorOpen]
  )

  const onPaneClick = useCallback(() => {
    setContextMenu(null)
    setDragReadyNodeId(null)
    // Empty-space click → deselect (and close the inspector).
    setSelectedNodeId(null)
    setFocusedNodeId(null)
  }, [setSelectedNodeId, setFocusedNodeId])

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_, node) => {
      clearHoverTimer()
      hoverTimerRef.current = setTimeout(() => {
        setDragReadyNodeId(node.id)
      }, nodeDragDelayMs)
    },
    [clearHoverTimer, nodeDragDelayMs]
  )

  const onNodeMouseLeave: NodeMouseHandler = useCallback(
    (_, node) => {
      clearHoverTimer()
      if (node.id === selectedNodeId) return
      hoverTimerRef.current = setTimeout(() => {
        setDragReadyNodeId((current) => (current === node.id ? null : current))
      }, 150)
    },
    [clearHoverTimer, selectedNodeId]
  )

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])

  useEffect(() => {
    setNodes((current) =>
      current.map((n) => {
        const isSelected = n.id === selectedNodeId
        const isFocused = n.id === (focusedNodeId ?? selectedNodeId)
        const canDrag = dragEnabledNodeIds.has(n.id)
        if (
          n.selected === isSelected &&
          (n.data as { selected?: boolean }).selected === isSelected &&
          (n.data as { canDrag?: boolean }).canDrag === canDrag
        ) {
          return n
        }
        return {
          ...n,
          selected: isSelected,
          data: {
            ...n.data,
            selected: isSelected,
            focused: isFocused,
            canDrag
          }
        }
      })
    )
  }, [selectedNodeId, focusedNodeId, dragEnabledNodeIds, setNodes])

  if (!snapshot) return null

  if (architectureMode === 'overview') {
    return (
      <div className="relative flex-1 h-full">
        <ArchitectureOverview />
        <NodeInspector />
        <AiChatBubble />
      </div>
    )
  }

  return (
    <div
      className={`relative flex-1 h-full graph-dot-surface graph-viewport-shell${viewportMoving ? ' is-zooming' : ''}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onMoveStart={markViewportMoving}
        onMove={markViewportMoving}
        onMoveEnd={() => {
          if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current)
          viewportMovingRef.current = false
          setViewportMoving(false)
          debugArchRender('zoom-end')
        }}
        edgesReconnectable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.88 }}
        minZoom={0.2}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        // Viewport culling keeps offscreen DOM out of the compositor (reduces tile memory).
        onlyRenderVisibleElements
        panOnScroll={panSensitivity >= 1}
        zoomOnScroll
        panOnDrag
        noDragClassName="prebase-nodrag"
        selectionOnDrag={false}
        nodesDraggable
        nodeDragThreshold={3}
        edgesFocusable={false}
        autoPanOnNodeDrag={false}
        defaultEdgeOptions={{
          type: 'architecture',
          style: { stroke: 'rgba(255,255,255,0.42)', strokeWidth: 1.25 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: 'rgba(255,255,255,0.45)'
          }
        }}
        className="bg-transparent"
      >
        <InitialViewportController />
        <LayoutViewportController />
        <FocusCameraController />
        <GraphMinimap hideWhileMoving={viewportMoving} />
      </ReactFlow>

      <ArchitectureGraphLegend nodes={snapshot.nodes} />
      {!viewportMoving && <HierarchyLabels />}

      <NodeInspector />
      <AiChatBubble />

      <AnimatePresence>
        {contextMenu && (
          <NodeContextMenu
            key={contextMenu.nodeId}
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-[#141518]/95 border border-border-subtle text-xs text-text-secondary pointer-events-none"
        >
          <span>{flowNodes.length} visible</span>
          <span className="w-px h-3 bg-border-subtle" />
          <span>{flowEdges.filter((e) => (e.data as { variant?: string })?.variant !== 'contains').length} links</span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
