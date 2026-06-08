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
import {
  applyGraphRotation3D,
  IDENTITY_ORIENTATION,
  type Orientation3D
} from '../../utils/network-rotation'
import { type Point3D } from '../../utils/network-layout'
import { layoutNetworkGraph } from '../../utils/network-layout'
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
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const nodeDragDelayMs = useSettingsStore((s) => s.nodeDragDelayMs)
  const networkDragDirection = useSettingsStore((s) => s.networkDragDirection)
  const lodThreshold = useSettingsStore((s) => s.networkLodNodeThreshold)
  const edgeOpacity = useSettingsStore((s) => s.networkEdgeOpacity)

  // Soft-white edges, derived from the user-tunable opacity (Issue #6 visibility).
  const defaultLink = `rgba(226,229,238,${Math.min(1, edgeOpacity * 1.15)})`
  const fadedLink = `rgba(200,203,214,${Math.max(0.08, edgeOpacity * 0.28)})`

  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<SimNode, SimLink> | undefined>(undefined)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const controls = useNetworkControls()
  const networkLayoutMode = useNetworkControls((s) => s.layoutMode)
  const networkSpreadScale = useNetworkControls((s) => s.spreadScale)
  const resetViewNonce = useNetworkControls((s) => s.resetViewNonce)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [liveCanvasRedraw, setLiveCanvasRedraw] = useState(false)
  const liveCanvasRedrawRef = useRef(false)
  liveCanvasRedrawRef.current = liveCanvasRedraw

  const orbit = useNetworkOrbit(reduceMotion)

  // ── Refs that the render loop reads (no per-frame React state) ───────────
  const zoomRef = useRef(1)
  const hoverScaleRef = useRef(1)
  const targetHoverRef = useRef(1)
  const intentRef = useRef<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Uniform graph settle offset — keeps edges visually attached (Obsidian-style). */
  const settleRef = useRef({ ox: 0, oy: 0, vx: 0, vy: 0 })
  const SETTLE_MAX = 5.5
  const SETTLE_DECAY = 0.86
  const SETTLE_SPRING = 0.82

  const setAnimating = useCallback((on: boolean) => {
    if (liveCanvasRedrawRef.current === on) return
    liveCanvasRedrawRef.current = on
    setLiveCanvasRedraw(on)
    if (on) fgRef.current?.resumeAnimation()
  }, [])

  // Rotation freeze state — base positions live in 3D sphere space.
  const frozenRef = useRef(false)
  const baseRef = useRef<Map<string, Point3D>>(new Map())
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
  const sphereRadius =
    Math.max(190, Math.min(310, Math.sqrt(Math.max(1, nodeCount)) * 22)) *
    networkSpreadScale *
    (controls.linkDistance / 48)
  const hugeGraph = nodeCount > Math.max(800, lodThreshold)

  const getGlobalSettle = useCallback(() => {
    const s = settleRef.current
    return { x: s.ox, y: s.oy }
  }, [])

  const impulseSettle = useCallback(
    (ax: number, ay: number, az: number, angle: number, boost = 1) => {
      const strength = Math.abs(angle) * 12 * boost
      if (strength < 0.0002) return
      const s = settleRef.current
      s.vx += (ax + az * 0.35) * angle * 180 * boost
      s.vy += (ay + az * 0.35) * angle * 180 * boost
      s.vx = Math.max(-SETTLE_MAX * 1.5, Math.min(SETTLE_MAX * 1.5, s.vx))
      s.vy = Math.max(-SETTLE_MAX * 1.5, Math.min(SETTLE_MAX * 1.5, s.vy))
      setAnimating(true)
    },
    [setAnimating]
  )
  const impulseSettleRef = useRef(impulseSettle)
  impulseSettleRef.current = impulseSettle

  // Pin simulation off — layout comes from the 3D sphere, not 2D force physics.
  useEffect(() => {
    const g = fgRef.current
    if (!g) return
    g.d3Force('charge')?.strength(0)
    g.d3Force('link')?.strength(0)
    g.d3Force('center')?.strength(0)
  }, [model])

  const seedNetworkLayout = useCallback(() => {
    const layout = layoutNetworkGraph(networkLayoutMode, model.nodes, model.links, sphereRadius)
    baseRef.current = layout
    centroidRef.current = { x: 0, y: 0 }
    frozenRef.current = true
    const depths = depthRef.current
    for (const nd of model.nodes as SimNode[]) {
      const base = layout.get(nd.id)
      if (!base) continue
      const projected = applyGraphRotation3D(base, 0, 0, IDENTITY_ORIENTATION)
      nd.x = projected.x
      nd.y = projected.y
      nd.fx = projected.x
      nd.fy = projected.y
      depths.set(nd.id, projected.depthScale)
    }
  }, [model.nodes, model.links, sphereRadius, networkLayoutMode])

  const seedNetworkLayoutRef = useRef(seedNetworkLayout)
  seedNetworkLayoutRef.current = seedNetworkLayout

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
    settleRef.current = { ox: 0, oy: 0, vx: 0, vy: 0 }
    frozenRef.current = false
    baseRef.current = new Map()
    depthRef.current = new Map()
    orbit.reset()
    seedNetworkLayoutRef.current()
    const g = fgRef.current
    if (!g || !model.nodes.length) return
    const t = setTimeout(() => fitViewRef.current(), 240)
    return () => clearTimeout(t)
  }, [model, orbit, networkLayoutMode, networkSpreadScale, controls.linkDistance])

  // Explicit "Reset view" request from the sidebar → re-fit camera + rotation.
  useEffect(() => {
    if (resetViewNonce === 0) return
    orbit.reset()
    seedNetworkLayoutRef.current()
    applyRotationRef.current(IDENTITY_ORIENTATION)
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

  const applyRotation = useCallback(
    (orientation: Orientation3D) => {
      if (!frozenRef.current) return
      const { x: cx, y: cy } = centroidRef.current
      const depths = depthRef.current
      for (const nd of model.nodes as SimNode[]) {
        const base = baseRef.current.get(nd.id)
        if (!base) continue
        const projected = applyGraphRotation3D(base, cx, cy, orientation)
        nd.x = projected.x
        nd.y = projected.y
        nd.fx = projected.x
        nd.fy = projected.y
        depths.set(nd.id, projected.depthScale)
      }
    },
    [model.nodes]
  )

  const applyRotationRef = useRef(applyRotation)
  applyRotationRef.current = applyRotation

  const hitRadiusFor = useCallback(
    (node: SimNode) => Math.max(18, Math.sqrt(node.val) * controls.nodeScale * 3.2 + 10),
    [controls.nodeScale]
  )

  const pickNodeAt = useCallback(
    (clientX: number, clientY: number) => {
      const g = fgRef.current
      if (!g) return false
      const coords = g.screen2GraphCoords(clientX, clientY)
      let bestDepth = -Infinity
      let hit = false
      for (const nd of model.nodes as SimNode[]) {
        const x = nd.x ?? 0
        const y = nd.y ?? 0
        const r = hitRadiusFor(nd)
        if (Math.hypot(coords.x - x, coords.y - y) > r) continue
        const depth = depthRef.current.get(nd.id) ?? 1
        if (depth >= bestDepth) {
          bestDepth = depth
          hit = true
        }
      }
      return hit
    },
    [model.nodes, hitRadiusFor]
  )
  const pickNodeAtRef = useRef(pickNodeAt)
  pickNodeAtRef.current = pickNodeAt

  useEffect(() => {
    orbit.setAttachOptions({
      onArm: () => {
        if (!frozenRef.current) seedNetworkLayoutRef.current()
        setAnimating(true)
      },
      onDragStart: () => {
        rotatingRef.current = true
        setAnimating(true)
      },
      onRotate: (orientation) => applyRotationRef.current(orientation),
      onDragEnd: (lastAngular) => {
        rotatingRef.current = false
        impulseSettleRef.current(
          lastAngular.ax,
          lastAngular.ay,
          lastAngular.az,
          lastAngular.angle,
          1.1
        )
      },
      isPointerOverNode: (x, y) => pickNodeAtRef.current(x, y),
      dragDirection: networkDragDirection
    })
  }, [orbit, networkDragDirection, setAnimating])

  // RAF: post-release momentum + hover scale only. Drag rotation is synchronous
  // on pointermove so it tracks the cursor in real time without teleporting.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      let needsRedraw = false
      const dragging = orbit.isDragging()

      if (!dragging) {
        const step = orbit.step()
        if (step.moving) needsRedraw = true
      } else {
        needsRedraw = true
      }

      let settling = false
      const s = settleRef.current
      s.ox += s.vx * 0.016
      s.oy += s.vy * 0.016
      s.vx *= SETTLE_DECAY
      s.vy *= SETTLE_DECAY
      s.ox *= SETTLE_SPRING
      s.oy *= SETTLE_SPRING
      if (Math.abs(s.vx) > 0.01 || Math.abs(s.vy) > 0.01 || Math.abs(s.ox) > 0.04) {
        settling = true
      } else {
        s.ox = 0
        s.oy = 0
        s.vx = 0
        s.vy = 0
      }
      s.ox = Math.max(-SETTLE_MAX, Math.min(SETTLE_MAX, s.ox))
      s.oy = Math.max(-SETTLE_MAX, Math.min(SETTLE_MAX, s.oy))

      if (settling) needsRedraw = true

      const target = targetHoverRef.current
      const cur = hoverScaleRef.current
      if (Math.abs(cur - target) > 0.002) {
        hoverScaleRef.current = cur + (target - cur) * 0.2
        needsRedraw = true
      } else if (cur !== target) {
        hoverScaleRef.current = target
        needsRedraw = true
      }

      if (needsRedraw) {
        setAnimating(true)
      } else if (!dragging && !rotatingRef.current) {
        setAnimating(false)
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [orbit, setAnimating])

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const onNodeHover = useCallback(
    (node: SimNode | null) => {
      setHoveredNodeId(node?.id ?? null)
      clearHoverTimer()
      if (!node) {
        intentRef.current = null
        targetHoverRef.current = 1
        return
      }
      targetHoverRef.current = 1.08
      hoverTimerRef.current = setTimeout(() => {
        intentRef.current = node.id
      }, nodeDragDelayMs)
    },
    [clearHoverTimer, nodeDragDelayMs]
  )

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])

  const nodeCanvasObject = useCallback(
    (node: SimNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const baseX = node.x ?? 0
      const baseY = node.y ?? 0
      const off = getGlobalSettle()
      const x = baseX + off.x
      const y = baseY + off.y
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
    [controls.nodeScale, controls.labelZoomThreshold, getGlobalSettle]
  )

  const nodePointerAreaPaint = useCallback(
    (node: SimNode, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const r = hitRadiusFor(node)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
    },
    [hitRadiusFor]
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

  const linkCanvasObject = useCallback(
    (link: SimLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const src = (typeof link.source === 'object' ? link.source : null) as SimNode | null
      const tgt = (typeof link.target === 'object' ? link.target : null) as SimNode | null
      if (!src || !tgt) return
      const offSrc = getGlobalSettle()
      const offTgt = offSrc
      const sx = (src.x ?? 0) + offSrc.x
      const sy = (src.y ?? 0) + offSrc.y
      const tx = (tgt.x ?? 0) + offTgt.x
      const ty = (tgt.y ?? 0) + offTgt.y
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = linkColor(link)
      ctx.lineWidth = linkWidth(link) / globalScale
      ctx.stroke()
    },
    [getGlobalSettle, linkColor, linkWidth]
  )

  useEffect(() => {
    setLiveCanvasRedraw(true)
    fgRef.current?.resumeAnimation()
    const t = setTimeout(() => setLiveCanvasRedraw(false), 120)
    return () => clearTimeout(t)
  }, [selectedNodeId, hoveredNodeId])

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
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => 'replace'}
        linkDirectionalArrowLength={controls.showArrows ? 4 : 0}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={0}
        linkHoverPrecision={0}
        warmupTicks={0}
        cooldownTicks={0}
        cooldownTime={0}
        d3AlphaDecay={1}
        d3VelocityDecay={1}
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
