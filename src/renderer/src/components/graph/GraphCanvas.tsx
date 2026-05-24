import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type OnNodesChange,
  type NodeMouseHandler,
  type EdgeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ArchitectureNode } from '../nodes/ArchitectureNode'
import { ArchitectureEdge } from '../edges/ArchitectureEdge'
import { GraphLegend } from './GraphLegend'
import { NodeInspector } from '../inspector/NodeInspector'
import { EdgeInspector } from '../inspector/EdgeInspector'
import { AiChatBubble } from '../ai/AiChatBubble'
import { NodeContextMenu } from './NodeContextMenu'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { toFlowEdges, toFlowNodes } from '../../utils/flow-adapter'

const nodeTypes = { architecture: ArchitectureNode }
const edgeTypes = { architecture: ArchitectureEdge }

function InitialViewportController() {
  const { fitView, getNodes } = useReactFlow()
  const snapshot = useGraphStore((s) => s.snapshot)
  const initialCameraDone = useGraphStore((s) => s.initialCameraDone)
  const setInitialCameraDone = useGraphStore((s) => s.setInitialCameraDone)
  const initialZoom = useSettingsStore((s) => s.initialZoom)

  useEffect(() => {
    if (!snapshot || initialCameraDone) return

    const t = setTimeout(() => {
      const nodes = getNodes()
      if (nodes.length === 0) {
        setInitialCameraDone(true)
        return
      }

      const entryId = snapshot.entryNodeId
      const focusNodes = entryId
        ? nodes.filter((n) => {
            if (n.id === entryId) return true
            const d = Math.hypot(
              n.position.x - (nodes.find((x) => x.id === entryId)?.position.x ?? 0),
              n.position.y - (nodes.find((x) => x.id === entryId)?.position.y ?? 0)
            )
            return d < 900
          })
        : nodes

      void fitView({
        nodes: focusNodes.length > 0 ? focusNodes : nodes,
        padding: 0.32,
        minZoom: 0.5,
        maxZoom: Math.max(0.75, initialZoom),
        duration: 850
      })
      setInitialCameraDone(true)
    }, 200)

    return () => clearTimeout(t)
  }, [snapshot, initialCameraDone, getNodes, fitView, setInitialCameraDone, initialZoom])

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
      void setCenter(node.position.x + 85, node.position.y + 26, {
        zoom: 1.05,
        duration: 650
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
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId)
  const filter = useGraphStore((s) => s.filter)
  const showMinimap = useGraphStore((s) => s.showMinimap)
  const showFolders = useGraphStore((s) => s.showFolders)
  const graphDepth = useGraphStore((s) => s.graphDepth)
  const layerVisibility = useGraphStore((s) => s.layerVisibility)
  const isolatedLayer = useGraphStore((s) => s.isolatedLayer)
  const focusNeighborhood = useGraphStore((s) => s.focusNeighborhood)
  const hideLowImportance = useGraphStore((s) => s.hideLowImportance)
  const userPositions = useGraphStore((s) => s.userPositions)
  const updateUserPosition = useGraphStore((s) => s.updateUserPosition)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const setInspectorOpen = useGraphStore((s) => s.setInspectorOpen)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(
    null
  )
  const hoveredEdgeIdRef = useRef<string | null>(null)
  const panSensitivity = useSettingsStore((s) => s.panSensitivity)

  const dimOnSearch = searchQuery.trim().length > 0

  const flowNodes = useMemo(() => {
    if (!snapshot) return []
    return toFlowNodes(snapshot, {
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      showFolders,
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood,
      hideLowImportance,
      userPositions,
      dimOnSearch
    })
  }, [
    snapshot,
    searchQuery,
    focusedNodeId,
    selectedNodeId,
    filter,
    showFolders,
    graphDepth,
    layerVisibility,
    isolatedLayer,
    focusNeighborhood,
    hideLowImportance,
    userPositions,
    dimOnSearch
  ])

  const flowOpts = useMemo(
    () => ({
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      showFolders,
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood,
      hideLowImportance,
      userPositions
    }),
    [
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      showFolders,
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood,
      hideLowImportance,
      userPositions
    ]
  )

  const flowEdges = useMemo(() => {
    if (!snapshot) return []
    return toFlowEdges(snapshot, { ...flowOpts, selectedEdgeId })
  }, [snapshot, flowOpts, selectedEdgeId])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => {
    setNodes(flowNodes)
  }, [flowNodes, setNodes])

  useEffect(() => {
    setEdges(flowEdges)
  }, [flowEdges, setEdges])

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
      setSelectedNodeId(node.id)
      setFocusedNodeId(node.id)
      setSelectedEdgeId(null)
      setInspectorOpen(true)
    },
    [setSelectedNodeId, setFocusedNodeId, setSelectedEdgeId, setInspectorOpen]
  )

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      setSelectedNodeId(node.id)
      setFocusedNodeId(node.id)
      setSelectedEdgeId(null)
      setInspectorOpen(true)
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
    },
    [setSelectedNodeId, setFocusedNodeId, setSelectedEdgeId, setInspectorOpen]
  )

  const onEdgeMouseEnter: EdgeMouseHandler = useCallback((_, edge) => {
    hoveredEdgeIdRef.current = edge.id
  }, [])

  const onEdgeMouseLeave: EdgeMouseHandler = useCallback(() => {
    hoveredEdgeIdRef.current = null
  }, [])

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      if (hoveredEdgeIdRef.current !== edge.id) return
      setSelectedEdgeId(edge.id)
      setSelectedNodeId(null)
    },
    [setSelectedEdgeId, setSelectedNodeId]
  )

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null)
    setContextMenu(null)
  }, [setSelectedEdgeId])

  if (!snapshot) return null

  return (
    <div className="relative flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.92 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        panOnScroll={panSensitivity >= 1}
        zoomOnScroll
        panOnDrag
        selectionOnDrag={false}
        nodesDraggable
        elementsSelectable
        edgesFocusable={false}
        autoPanOnNodeDrag={false}
        defaultEdgeOptions={{
          type: 'architecture',
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'rgba(255,255,255,0.2)' }
        }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(255,255,255,0.035)"
        />
        <InitialViewportController />
        <FocusCameraController />
        {showMinimap && (
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            className="!bottom-6 !left-6 !right-auto"
            nodeColor={(n) => (n.data as { color?: string })?.color ?? '#3f3f46'}
          />
        )}
      </ReactFlow>

      <GraphLegend />

      <NodeInspector />
      <EdgeInspector />
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
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-surface-overlay/80 border border-border-subtle backdrop-blur-md text-xs text-text-secondary pointer-events-none"
        >
          <span>{flowNodes.length} visible</span>
          <span className="w-px h-3 bg-border-subtle" />
          <span>{flowEdges.length} dependencies</span>
          {snapshot.entryNodeId && (
            <>
              <span className="w-px h-3 bg-border-subtle" />
              <span className="text-amber-400/90">Centered on entry</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
