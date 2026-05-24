import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import { useGraphStore } from '../../state/graph-store'
import { toFlowEdges, toFlowNodes } from '../../utils/flow-adapter'

const nodeTypes = { architecture: ArchitectureNode }
const edgeTypes = { architecture: ArchitectureEdge }

function InitialCameraController() {
  const { setCenter, getNode } = useReactFlow()
  const snapshot = useGraphStore((s) => s.snapshot)
  const initialCameraDone = useGraphStore((s) => s.initialCameraDone)
  const setInitialCameraDone = useGraphStore((s) => s.setInitialCameraDone)

  useEffect(() => {
    if (!snapshot || initialCameraDone) return

    const entryId = snapshot.entryNodeId
    const t = setTimeout(() => {
      if (entryId) {
        const node = getNode(entryId)
        if (node) {
          void setCenter(node.position.x + 90, node.position.y + 28, {
            zoom: 0.95,
            duration: 900
          })
          setInitialCameraDone(true)
          return
        }
      }
      setInitialCameraDone(true)
    }, 120)

    return () => clearTimeout(t)
  }, [snapshot, initialCameraDone, getNode, setCenter, setInitialCameraDone])

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
  const userPositions = useGraphStore((s) => s.userPositions)
  const updateUserPosition = useGraphStore((s) => s.updateUserPosition)
  const activeLayers = useGraphStore((s) => s.activeLayers)
  const maxNodesVisible = useGraphStore((s) => s.maxNodesVisible)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)

  const flowNodes = useMemo(() => {
    if (!snapshot) return []
    return toFlowNodes(snapshot, {
      searchQuery,
      focusedNodeId,
      selectedNodeId,
      filter,
      showFolders,
      graphDepth,
      userPositions,
      dimUnrelated: true,
      activeLayers,
      maxNodesVisible
    })
  }, [
    snapshot,
    searchQuery,
    focusedNodeId,
    selectedNodeId,
    filter,
    showFolders,
    graphDepth,
    userPositions,
    activeLayers,
    maxNodesVisible
  ])

  const flowEdges = useMemo(() => {
    if (!snapshot) return []
    return toFlowEdges(snapshot, {
      showFolders,
      focusedNodeId,
      selectedNodeId,
      selectedEdgeId,
      searchQuery,
      graphDepth
    })
  }, [snapshot, showFolders, focusedNodeId, selectedNodeId, selectedEdgeId, searchQuery, graphDepth])

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
    },
    [setSelectedNodeId, setFocusedNodeId, setSelectedEdgeId]
  )

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      setSelectedEdgeId(edge.id)
      setSelectedNodeId(null)
    },
    [setSelectedEdgeId, setSelectedNodeId]
  )

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null)
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
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.95 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        zoomOnScroll
        panOnDrag
        selectionOnDrag={false}
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
        <InitialCameraController />
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
