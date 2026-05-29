import { useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import {
  getHierarchyRingLabels,
  type HierarchyRingLabel
} from '@core/layout/hierarchy-layout'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'

export function HierarchyLabels() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const showHierarchyLabels = useSettingsStore((s) => s.showHierarchyLabels)
  const { x, y, zoom } = useViewport()

  const labels = useMemo(() => {
    if (!showHierarchyLabels || !snapshot?.entryNodeId || layoutMode !== 'hierarchy') return []
    return getHierarchyRingLabels(snapshot.nodes, snapshot.edges, snapshot.entryNodeId)
  }, [snapshot, layoutMode, showHierarchyLabels])

  if (labels.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      aria-hidden
    >
      <div
        style={{
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {labels.map((label: HierarchyRingLabel) => (
          <div key={label.depth}>
            <div
              className="absolute rounded-full border border-teal-500/10 pointer-events-none"
              style={{
                left: 0,
                top: 0,
                width: label.radius * 2,
                height: label.radius * 2,
                transform: `translate(-50%, -50%)`
              }}
            />
            <div
              className="absolute px-2 py-0.5 rounded-md text-[9px] tracking-wide text-text-muted/90 bg-surface-overlay/65 border border-border-subtle/50 backdrop-blur-sm whitespace-nowrap"
              style={{
                left: label.x,
                top: label.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {label.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
