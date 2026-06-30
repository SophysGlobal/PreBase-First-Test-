import { useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import {
  getHierarchyCenterRadius,
  getHierarchyRingBandsForSnapshot
} from '@core/layout/hierarchy-layout'
import { consolidateHierarchyDepthVisuals } from '@core/layout/hierarchy-depth-visuals'
import { depthLevelColorBase } from '@core/layout/layout-depth-colors'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { getEffectiveGraphPositions } from '../../utils/effective-graph-positions'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'

interface HierarchyLabelsProps {
  hidden?: boolean
}

function annulusPath(cx: number, cy: number, innerR: number, outerR: number): string {
  if (outerR <= innerR + 0.5) return ''
  return [
    `M ${cx + outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 0 ${cx - outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 0 ${cx + outerR} ${cy}`,
    `M ${cx + innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 1 ${cx - innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 1 ${cx + innerR} ${cy}`
  ].join(' ')
}

/**
 * Colored concentric ring depth guides for Hierarchy layout.
 * Rendered as an absolute SVG that covers the graph shell, using useViewport()
 * to convert graph→screen coordinates on every frame (no debounce, no lag).
 * Placed BEFORE <ReactFlow> in the DOM so it renders behind nodes.
 */
export function HierarchyLabels({ hidden = false }: HierarchyLabelsProps) {
  const snapshot = useGraphStore((s) => s.snapshot)
  const userPositions = useGraphStore((s) => s.userPositions)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const selectedRingKey = useGraphStore((s) => s.selectedRingKey)
  const settings = useSettingsStore()

  // Reactive viewport transform — updates on every pan/zoom frame, no debounce
  const { x: tx, y: ty, zoom } = useViewport()

  const ringData = useMemo(() => {
    if (layoutMode !== 'hierarchy' || !snapshot?.entryNodeId) return null
    const positions = getEffectiveGraphPositions(snapshot, userPositions)
    if (!positions[snapshot.entryNodeId]) return null

    const runtime = layoutRuntimeFromSettings(settings)
    const bands = getHierarchyRingBandsForSnapshot(
      snapshot.nodes,
      snapshot.edges,
      snapshot.entryNodeId,
      positions,
      runtime,
      runtime.organizationMethod
    )
    if (bands.length === 0) return null

    const centerRadius = getHierarchyCenterRadius(runtime)
    const depthVisuals = consolidateHierarchyDepthVisuals(bands, centerRadius)
    const entry = positions[snapshot.entryNodeId]
    // Graph-space center of the entry node
    const gcx = (entry?.x ?? 0) + LAYOUT_NODE_BOX.width / 2
    const gcy = (entry?.y ?? 0) + LAYOUT_NODE_BOX.height / 2

    const selectedDepth = bands.find((b) => b.key === selectedRingKey)?.semanticDepth ?? null

    return { depthVisuals, gcx, gcy, centerRadius, selectedDepth }
  }, [snapshot, userPositions, layoutMode, settings, selectedRingKey])

  if (hidden || !ringData) return null

  const { depthVisuals, gcx, gcy, centerRadius, selectedDepth } = ringData

  // Convert graph-space center to screen-space for the SVG overlay
  const scx = gcx * zoom + tx
  const scy = gcy * zoom + ty

  return (
    <svg
      className="absolute inset-0 pointer-events-none hierarchy-labels-layer"
      style={{ width: '100%', height: '100%', zIndex: 1, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        {depthVisuals.map((depthRing) => {
          const baseColor = depthLevelColorBase(depthRing.depth)
          const sr = depthRing.outerRadius * zoom
          const innerPct = Math.min(
            0.90,
            depthRing.innerRadius / Math.max(1, depthRing.outerRadius)
          )
          const selected = selectedDepth === depthRing.depth
          return (
            <radialGradient
              key={`grad-depth-${depthRing.depth}`}
              id={`h-ring-grad-depth-${depthRing.depth}`}
              cx={scx}
              cy={scy}
              r={sr}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset={`${innerPct * 100}%`} stopColor={baseColor} stopOpacity={selected ? 0.22 : 0.12} />
              <stop offset={`${(innerPct + (1 - innerPct) * 0.5) * 100}%`} stopColor={baseColor} stopOpacity={selected ? 0.32 : 0.20} />
              <stop offset="100%" stopColor={baseColor} stopOpacity={selected ? 0.46 : 0.30} />
            </radialGradient>
          )
        })}
      </defs>

      {/* Entry node center guide */}
      <circle
        cx={scx}
        cy={scy}
        r={centerRadius * zoom}
        fill="rgba(232,184,74,0.12)"
        stroke="rgba(232,184,74,0.65)"
        strokeWidth={Math.max(0.8, 1.2 * zoom)}
      />

      {depthVisuals.map((depthRing) => {
        const selected = selectedDepth === depthRing.depth
        const sir = depthRing.innerRadius * zoom
        const sor = depthRing.outerRadius * zoom
        const path = annulusPath(scx, scy, sir, sor)
        if (!path) return null
        const baseColor = depthLevelColorBase(depthRing.depth)
        return (
          <g key={`depth-${depthRing.depth}`}>
            {/* Annulus fill */}
            <path
              d={path}
              fill={`url(#h-ring-grad-depth-${depthRing.depth})`}
              fillRule="evenodd"
            />
            {/* Inner ring border */}
            <circle
              cx={scx}
              cy={scy}
              r={sir}
              fill="none"
              stroke={baseColor}
              strokeWidth={selected ? Math.max(0.8, 1.0 * zoom) : Math.max(0.5, 0.6 * zoom)}
              strokeOpacity={selected ? 0.55 : 0.30}
            />
            {/* Outer ring border — primary depth indicator */}
            <circle
              cx={scx}
              cy={scy}
              r={sor}
              fill="none"
              stroke={baseColor}
              strokeWidth={selected ? Math.max(1.2, 1.8 * zoom) : Math.max(0.8, 1.0 * zoom)}
              strokeOpacity={selected ? 0.80 : 0.50}
            />
          </g>
        )
      })}
    </svg>
  )
}
