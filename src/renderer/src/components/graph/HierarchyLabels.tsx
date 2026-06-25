import { useEffect, useMemo, useState } from 'react'
import { useStoreApi } from '@xyflow/react'
import { getHierarchyRingGuides } from '@core/layout/hierarchy-layout'
import { depthLevelColor } from '@core/layout/layout-depth-colors'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'

interface ScreenRing {
  key: string
  depth: number
  left: number
  top: number
  size: number
}

interface HierarchyLabelsProps {
  hidden?: boolean
}

/** Colored concentric ring guides — depth encoded by ring color. */
export function HierarchyLabels({ hidden = false }: HierarchyLabelsProps) {
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const selectedRingKey = useGraphStore((s) => s.selectedRingKey)
  const settings = useSettingsStore()
  const store = useStoreApi()
  const [screenRings, setScreenRings] = useState<ScreenRing[]>([])

  const ringData = useMemo(() => {
    if (layoutMode !== 'hierarchy' || !snapshot?.entryNodeId || !snapshot.positions) return null
    const runtime = layoutRuntimeFromSettings(settings)
    const rings = getHierarchyRingGuides(
      snapshot.nodes,
      snapshot.edges,
      snapshot.entryNodeId,
      runtime,
      runtime.organizationMethod
    ).map((g) => ({
      key: `${g.depth}-${g.ringIndex}-${g.radius}`,
      depth: g.depth,
      radius: g.radius
    }))
    if (rings.length === 0) return null
    const entry = snapshot.positions[snapshot.entryNodeId]
    const cx = (entry?.x ?? 0) + LAYOUT_NODE_BOX.width / 2
    const cy = (entry?.y ?? 0) + LAYOUT_NODE_BOX.height / 2
    return { rings, cx, cy }
  }, [snapshot, layoutMode, settings])

  useEffect(() => {
    if (!ringData || hidden) {
      setScreenRings([])
      return
    }

    let debounce = 0
    const project = () => {
      const [tx, ty, zoom] = store.getState().transform
      const { rings, cx, cy } = ringData
      const sx = cx * zoom + tx
      const sy = cy * zoom + ty
      setScreenRings(
        rings.map((ring) => ({
          key: ring.key,
          depth: ring.depth,
          left: sx - ring.radius * zoom,
          top: sy - ring.radius * zoom,
          size: ring.radius * 2 * zoom
        }))
      )
    }

    const schedule = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(project, 120)
    }

    project()
    return store.subscribe((state, prev) => {
      const t = state.transform
      const pt = prev.transform
      if (t[0] === pt[0] && t[1] === pt[1] && t[2] === pt[2]) return
      schedule()
    })
  }, [ringData, hidden, store])

  if (hidden || !ringData || screenRings.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden hierarchy-labels-layer transition-opacity duration-200"
      aria-hidden
    >
      {screenRings.map((ring) => {
        const selected = selectedRingKey === ring.key
        const color = depthLevelColor(ring.depth)
        return (
          <div
            key={ring.key}
            className={`absolute rounded-full border transition-colors ${
              selected ? 'border-accent/55 shadow-[0_0_0_1px_rgba(45,212,191,0.12)]' : ''
            }`}
            style={{
              left: ring.left,
              top: ring.top,
              width: ring.size,
              height: ring.size,
              borderColor: selected ? undefined : color,
              backgroundColor: selected ? 'rgba(45,212,191,0.04)' : color.replace(/[\d.]+\)$/, '0.06)')
            }}
          />
        )
      })}
    </div>
  )
}
