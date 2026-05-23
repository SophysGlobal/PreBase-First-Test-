import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnNodesChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ArchitectureNode } from '../nodes/ArchitectureNode'
import { useGraphStore } from '../../state/graph-store'
import { toFlowEdges, toFlowNodes } from '../../utils/flow-adapter'

const nodeTypes = { architecture: ArchitectureNode }

function FocusController() {
  const { setCenter, getNode } = useReactFlow()
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const prevFocus = useRef<string | null>(null)

  useEffect(() => {
    if (!focusedNodeId || focusedNodeId === prevFocus.current) return
    prevFocus.current = focusedNodeId

    const node = getNode(focusedNodeId)
    if (!node) return

    const t = setTimeout(() => {
      void setCenter(
        node.position.x + 80,
        node.position.y + 24,
        { zoom: 1.2, duration: 600 }
      )
    }, 50)
    return () => clearTimeout(t)
  }, [focusedNodeId, getNode, setCenter])

  return null
}

export function GraphCanvas() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const filter = useGraphStore((s) => s.filter)
  const showMinimap = useGraphStore((s) => s.showMinimap)
  const showFolders = useGraphStore((s) => s.showFolders)
  const userPositions = useGraphStore((s) => s.userPositions)
  const updateUserPosition = useGraphStore((s) => s.updateUserPosition)

  const flowNodes = useMemo(() => {
    if (!snapshot) return []
    return toFlowNodes(snapshot, {
      searchQuery,
      focusedNodeId,
      filter,
      showFolders,
      userPositions,
      dimUnrelated: true
    })
  }, [snapshot, searchQuery, focusedNodeId, filter, showFolders, userPositions])

  const flowEdges = useMemo(() => {
    if (!snapshot) return []
    return toFlowEdges(snapshot, { showFolders, focusedNodeId, searchQuery })
  }, [snapshot, showFolders, focusedNodeId, searchQuery])

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

  if (!snapshot) return null

  return (
    <div className="relative flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <FocusController />
        {showMinimap && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            className="!bottom-6 !right-6"
            nodeColor={(n) => (n.data as { color?: string })?.color ?? '#3f3f46'}
          />
        )}
      </ReactFlow>

      <AnimatePresence>
        {snapshot && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-surface-overlay/80 border border-border-subtle backdrop-blur-md text-xs text-text-secondary"
          >
            <span>{snapshot.nodes.filter((n) => n.kind !== 'folder').length} nodes</span>
            <span className="w-px h-3 bg-border-subtle" />
            <span>{snapshot.edges.filter((e) => e.kind === 'import').length} imports</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
