import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject
} from 'react-force-graph-2d'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { useNetworkControls } from '../../state/network-controls-store'
import { useNetworkOrbit } from '../../hooks/use-network-camera'
import { applyGraphRotation3D, type Rotation3D } from '../../utils/network-rotation'
import { buildNetworkModel, type NetworkLink, type NetworkNode } from '../../utils/network-model'
import type { FlowAdapterOptions } from '../../utils/flow-adapter'
import { NetworkGraphLegend } from './GraphLegendBar'
import { NodeInspector } from '../inspector/NodeInspector'
import { AiChatBubble } from '../ai/AiChatBubble'

const SELECTED_COLOR = '#2dd4bf'
const SELECTED_GLOW = 'rgba(45,212,191,0.5)'
// Desaturated whitish for unselected nodes when a selection is active.
const DIM_NODE = 'rgba(208,210,218,0.55)'
const HIGHLIGHT_LINK = 'rgba(94,234,212,0.9)'

type SimNode = NetworkNode & NodeObject
type SimLink = NetworkLink & LinkObject

function resolveId(ref: unknown): string {
  if (typeof ref === 'string') return ref
  return (ref as { id: string }).id
}

export function NetworkGraphView() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const filter = useGraphStore((s) => s.filter)
  const graphDepth = useGraphStore((s) => s.graphDepth)
  const layerVisibility = useGraphStore((s) => s.layerVisibility)
  const isolatedLayer = useGraphStore((s) => s.isolatedLayer)
  const hideLowImportance = useGraphStore((s) => s.hideLowImportance)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const expandedFolderIds = useGraphStore((s) => s.expandedFolderIds)
  const selectNodeInGraph = useGraphStore((s) => s.selectNodeInGraph)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)

  const maxRenderedNodes = useSettingsStore((s) => s.maxRenderedNodes)
  const visibleRelatedConnections = useSettingsStore((s) => s.visibleRelatedConnections)
  const graphQuality = useSettingsStore((s) => s.graphQuality)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const nodeDragDelayMs = useSettingsStore((s) => s.nodeDragDelayMs)
  const lodThreshold = useSettingsStore((s) => s.networkLodNodeThreshold)
  const physicsStrength = useSettingsStore((s) => s.networkPhysicsStrength)
  const edgeOpacity = useSettingsStore((s) => s.networkEdgeOpacity)

  // Soft-white edges, derived from the user-tunable opacity (Issue #6 visibility).
  const defaultLink = `rgba(226,229,238,${Math.min(1, edgeOpacity * 1.15)})`
  const fadedLink = `rgba(200,203,214,${Math.max(0.08, edgeOpacity * 0.28)})`

  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<SimNode, SimLink> | undefined>(undefined)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const controls = useNetworkControls()
  const resetViewNonce = useNetworkControls((s) => s.resetViewNonce)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [liveCanvasRedraw, setLiveCanvasRedraw] = useState(false)

  const orbit = useNetworkOrbit(reduceMotion)

  // ── Refs that the render loop reads (no per-frame React state) ───────────
  const zoomRef = useRef(1)
  const hoverScaleRef = useRef(1)
  const targetHoverRef = useRef(1)
  const intentRef = useRef<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Rotation freeze state (rotate node data around a fixed centroid in 3D).
  const frozenRef = useRef(false)
  const baseRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const depthRef = useRef<Map<string, number>>(new Map())
  const centroidRef = useRef({ x: 0, y: 0 })
  const rotatingRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setDims({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The model intentionally does NOT depend on selection/focus. buildNetworkModel
  // does not read them, and rebuilding on selection would discard node positions,
  // reset rotation, and re-fit the camera on every click (graph instability).
  // Selection styling is applied at draw time via selectedRef/neighborRef.
  const model = useMemo(() => {
    if (!snapshot) return { nodes: [], links: [] }
    const opts: FlowAdapterOptions = {
      searchQuery: '',
      focusedNodeId: null,
      selectedNodeId: null,
      filter,
      graphOrganizationMode: 'dependencies',
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood: false,
      hideLowImportance,
      userPositions: {},
      dimOnSearch: false,
      expandedFolderIds,
      dragEnabledNodeIds: new Set<string>(),
      showEdgeLabels: false,
      visibleRelatedConnections,
      maxRenderedNodes
    }
    return buildNetworkModel(snapshot, opts)
  }, [
    snapshot,
    filter,
    graphDepth,
    layerVisibility,
    isolatedLayer,
    hideLowImportance,
    expandedFolderIds,
    visibleRelatedConnections,
    maxRenderedNodes
  ])

  const neighborIds = useMemo(() => {
    const set = new Set<string>()
    if (!selectedNodeId) return set
    set.add(selectedNodeId)
    for (const link of model.links) {
      const s = resolveId(link.source)
      const t = resolveId(link.target)
      if (s === selectedNodeId) set.add(t)
      if (t === selectedNodeId) set.add(s)
    }
    return set
  }, [selectedNodeId, model.links])
  const neighborRef = useRef(neighborIds)
  neighborRef.current = neighborIds
  const selectedRef = useRef(selectedNodeId)
  selectedRef.current = selectedNodeId
  const hoveredRef = useRef(hoveredNodeId)
  hoveredRef.current = hoveredNodeId

  const nodeCount = model.nodes.length
  const largeGraph = nodeCount > 500
  const hugeGraph = nodeCount > Math.max(800, lodThreshold)
  const lowMotion = reduceMotion || graphQuality === 'performance' || hugeGraph

  // Radial containment: pull any node that drifts past a bounded disc back toward
  // the center each tick. This keeps the graph a cohesive, centered shape and
  // stops disconnected files from flying infinitely far away (Issue: organization).
  const boundRadius = Math.max(220, Math.sqrt(Math.max(1, nodeCount)) * 46)
  const clampPositions = useCallback(() => {
    const r = boundRadius
    for (const n of model.nodes as SimNode[]) {
      const x = n.x ?? 0
      const y = n.y ?? 0
      const d = Math.hypot(x, y)
      if (d > r) {
        const k = r / d
        n.x = x * k
        n.y = y * k
        if (n.vx) n.vx *= 0.5
        if (n.vy) n.vy *= 0.5
      }
    }
  }, [model.nodes, boundRadius])

  // Apply force-control tuning. The advanced "physics strength" multiplier
  // scales repulsion/centering so the whole simulation can feel looser/tighter.
  useEffect(() => {
    const g = fgRef.current
    if (!g) return
    g.d3Force('charge')?.strength(controls.repelForce * physicsStrength)
    g.d3Force('link')?.distance(controls.linkDistance)
    g.d3Force('center')?.strength(controls.centerForce * physicsStrength)
    g.d3ReheatSimulation()
  }, [controls.repelForce, controls.linkDistance, controls.centerForce, physicsStrength])

  // Comfortable, clamped fit. Plain zoomToFit zooms out until ALL nodes fit,
  // which makes a spread force-layout microscopic. We center on the graph and
  // clamp zoom to a readable range instead (Issue #4).
  const fitView = useCallback(
    (durationMs = 400) => {
      const g = fgRef.current
      if (!g) return
      const bbox = g.getGraphBbox()
      if (!bbox) {
        g.zoomToFit(durationMs, 60)
        return
      }
      const w = Math.max(1, bbox.x[1] - bbox.x[0])
      const h = Math.max(1, bbox.y[1] - bbox.y[0])
      const pad = 96
      const zx = (dims.width - pad) / w
      const zy = (dims.height - pad) / h
      const z = Math.max(0.6, Math.min(1.4, Math.min(zx, zy)))
      g.centerAt((bbox.x[0] + bbox.x[1]) / 2, (bbox.y[0] + bbox.y[1]) / 2, durationMs)
      g.zoom(z, durationMs)
    },
    [dims.width, dims.height]
  )
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

  // New model → reset rotation + fit ONCE. Reads fitView via ref so window/sidebar
  // resizes do not re-trigger a camera reset (Issue #4: no repeated zoom-out).
  useEffect(() => {
    frozenRef.current = false
    baseRef.current = new Map()
    depthRef.current = new Map()
    orbit.reset()
    const g = fgRef.current
    if (!g || !model.nodes.length) return
    const t = setTimeout(() => fitViewRef.current(), 240)
    return () => clearTimeout(t)
  }, [model, orbit])

  // Explicit "Reset view" request from the sidebar → re-fit camera + rotation.
  useEffect(() => {
    if (resetViewNonce === 0) return
    orbit.reset()
    fitViewRef.current(400)
  }, [resetViewNonce, orbit])

  // Pause/resume simulation with tab visibility (CPU/GPU savings).
  useEffect(() => {
    const onVis = () => {
      const g = fgRef.current
      if (!g) return
      if (document.hidden) g.pauseAnimation()
      else g.resumeAnimation()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Attach orbit pointer handlers to the graph container (not the canvas — the
  // canvas may not exist on first paint and force-graph owns canvas events).
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    return orbit.attach(root)
  }, [orbit, dims.width, dims.height])

  const freezeIfNeeded = useCallback(() => {
    if (frozenRef.current) return
    const nodes = model.nodes as SimNode[]
    let sx = 0
    let sy = 0
    let n = 0
    for (const nd of nodes) {
      if (typeof nd.x === 'number' && typeof nd.y === 'number') {
        sx += nd.x
        sy += nd.y
        n++
      }
    }
    if (!n) return
    centroidRef.current = { x: sx / n, y: sy / n }
    baseRef.current = new Map(nodes.map((nd) => [nd.id, { x: nd.x ?? 0, y: nd.y ?? 0 }]))
    for (const nd of nodes) {
      nd.fx = nd.x
      nd.fy = nd.y
    }
    frozenRef.current = true
  }, [model.nodes])

  const applyRotation = useCallback(
    (rotation: Rotation3D) => {
      freezeIfNeeded()
      if (!frozenRef.current) return
      const { x: cx, y: cy } = centroidRef.current
      const depths = depthRef.current
      for (const nd of model.nodes as SimNode[]) {
        const base = baseRef.current.get(nd.id)
        if (!base) continue
        const projected = applyGraphRotation3D(base.x, base.y, cx, cy, rotation)
        nd.x = projected.x
        nd.y = projected.y
        nd.fx = projected.x
        nd.fy = projected.y
        depths.set(nd.id, projected.depthScale)
      }
    },
    [model.nodes, freezeIfNeeded]
  )

  const applyRotationRef = useRef(applyRotation)
  applyRotationRef.current = applyRotation
  const freezeIfNeededRef = useRef(freezeIfNeeded)
  freezeIfNeededRef.current = freezeIfNeeded

  useEffect(() => {
    orbit.setAttachOptions({
      onDragStart: () => {
        freezeIfNeededRef.current()
        rotatingRef.current = true
        setLiveCanvasRedraw(true)
        fgRef.current?.resumeAnimation()
      },
      onRotate: (rotation) => applyRotationRef.current(rotation),
      onDragEnd: () => {
        rotatingRef.current = false
        setLiveCanvasRedraw(false)
      }
    })
  }, [orbit])

  // RAF: post-release momentum + hover scale only. Drag rotation is synchronous
  // on pointermove so it tracks the cursor in real time without teleporting.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (!orbit.isDragging()) {
        const step = orbit.step()
        if (!step.moving && rotatingRef.current) {
          rotatingRef.current = false
          setLiveCanvasRedraw(false)
        }
      }

      const target = targetHoverRef.current
      const cur = hoverScaleRef.current
      if (Math.abs(cur - target) > 0.002) {
        hoverScaleRef.current = cur + (target - cur) * 0.2
      } else if (cur !== target) {
        hoverScaleRef.current = target
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [orbit])

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const onNodeHover = useCallback(
    (node: SimNode | null) => {
      orbit.setHovered(!!node)
      setHoveredNodeId(node?.id ?? null)
      clearHoverTimer()
      if (!node) {
        intentRef.current = null
        targetHoverRef.current = 1
        return
      }
      targetHoverRef.current = 1.1
      // Intentionality: only after a deliberate hover does the node "focus".
      hoverTimerRef.current = setTimeout(() => {
        intentRef.current = node.id
      }, nodeDragDelayMs)
    },
    [orbit, clearHoverTimer, nodeDragDelayMs]
  )

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])

  const nodeCanvasObject = useCallback(
    (node: SimNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const depthScale = depthRef.current.get(node.id) ?? 1
      const sel = selectedRef.current
      const isSelected = node.id === sel
      const isHovered = node.id === hoveredRef.current
      const dimmed = sel !== null && !neighborRef.current.has(node.id) && !isSelected

      let scaleMul = Math.max(0.72, Math.min(1.18, depthScale))
      if (isHovered) scaleMul = Math.max(scaleMul, hoverScaleRef.current)
      if (isSelected) scaleMul = Math.max(scaleMul, 1.12)

      const r = (Math.sqrt(node.val) * controls.nodeScale * 1.7 + 1.6) * scaleMul
      const depthAlpha = Math.max(0.45, Math.min(1, 0.55 + depthScale * 0.45))

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = isSelected ? SELECTED_COLOR : dimmed ? DIM_NODE : node.color
      ctx.globalAlpha = isSelected ? 1 : depthAlpha
      ctx.fill()
      ctx.globalAlpha = 1

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(x, y, r + 2.5 / globalScale, 0, 2 * Math.PI)
        ctx.strokeStyle = SELECTED_GLOW
        ctx.lineWidth = 2.4 / globalScale
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, r + 4.5 / globalScale, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(94,234,212,0.3)'
        ctx.lineWidth = 1 / globalScale
        ctx.stroke()
      } else if (isHovered && intentRef.current === node.id) {
        ctx.beginPath()
        ctx.arc(x, y, r + 1.8 / globalScale, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(94,234,212,0.4)'
        ctx.lineWidth = 1.2 / globalScale
        ctx.stroke()
      }

      if (zoomRef.current >= controls.labelZoomThreshold || isSelected || isHovered) {
        const fontSize = Math.max(9, 10 / globalScale)
        ctx.font = `${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = isSelected ? 'rgba(94,234,212,0.95)' : 'rgba(205,205,215,0.9)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.label, x + r + 3, y)
      }
    },
    [controls.nodeScale, controls.labelZoomThreshold]
  )

  const nodePointerAreaPaint = useCallback(
    (node: SimNode, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      // Generous hitbox (larger than the visible dot) for reliable selection.
      const r = Math.max(11, Math.sqrt(node.val) * controls.nodeScale * 3 + 5)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
    },
    [controls.nodeScale]
  )

  const linkColor = useCallback(
    (l: SimLink) => {
      const sel = selectedRef.current
      if (!sel) return defaultLink
      const s = resolveId(l.source)
      const t = resolveId(l.target)
      return s === sel || t === sel ? HIGHLIGHT_LINK : fadedLink
    },
    [defaultLink, fadedLink]
  )

  const linkWidth = useCallback(
    (l: SimLink) => {
      const base = controls.linkWidth * 1.2
      const sel = selectedRef.current
      if (!sel) return base
      const s = resolveId(l.source)
      const t = resolveId(l.target)
      return s === sel || t === sel ? base * 2.4 : base * 0.7
    },
    [controls.linkWidth]
  )

  if (!snapshot) return null

  return (
    <div ref={containerRef} className="relative flex-1 h-full overflow-hidden bg-[#0d0e10]">
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        graphData={model}
        backgroundColor="rgba(13,14,16,0)"
        enableNodeDrag={false}
        enablePanInteraction={false}
        enableZoomInteraction
        autoPauseRedraw={!liveCanvasRedraw}
        nodeRelSize={1}
        nodeVal={(n: SimNode) => n.val}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={controls.showArrows ? 4 : 0}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={0}
        linkHoverPrecision={0}
        warmupTicks={lowMotion ? 0 : largeGraph ? 12 : 28}
        cooldownTicks={largeGraph ? 40 : 80}
        cooldownTime={hugeGraph ? 4000 : largeGraph ? 8000 : 12000}
        d3AlphaDecay={hugeGraph ? 0.05 : 0.022}
        d3VelocityDecay={hugeGraph ? 0.45 : 0.35}
        onEngineTick={clampPositions}
        onZoom={(transform) => {
          zoomRef.current = transform.k
        }}
        onBackgroundClick={() => {
          if (orbit.consumedDrag()) return // ignore click that ended a rotation drag
          // Empty-space click → deselect.
          setSelectedNodeId(null)
          setFocusedNodeId(null)
        }}
        onNodeHover={(n) => onNodeHover(n as SimNode | null)}
        onNodeClick={(n: SimNode) => {
          if (orbit.consumedDrag()) return // this click ended a rotation, not a select
          // Deterministic toggle: same node → deselect, different node → switch.
          if (selectedRef.current === n.id) {
            setSelectedNodeId(null)
            setFocusedNodeId(null)
          } else {
            selectNodeInGraph(n.id)
          }
        }}
      />

      <NetworkGraphLegend nodes={snapshot.nodes} />
      <NodeInspector />
      <AiChatBubble />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-[#141518] border border-border-subtle text-xs text-text-secondary pointer-events-none max-w-[90vw] flex-wrap justify-center">
        <span>{nodeCount} nodes</span>
        <span className="w-px h-3 bg-border-subtle" />
        <span>{model.links.length} links</span>
        {hugeGraph && (
          <>
            <span className="w-px h-3 bg-border-subtle" />
            <span className="text-amber-400/90">performance mode</span>
          </>
        )}
        <span className="w-px h-3 bg-border-subtle" />
        <span className="text-text-muted">drag to rotate in 3D · scroll to zoom · click a node to inspect</span>
      </div>
    </div>
  )
}
