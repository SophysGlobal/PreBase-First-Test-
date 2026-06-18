import { useEffect, useMemo, useState } from 'react'
import { useStoreApi } from '@xyflow/react'
import { getHierarchyRingLayers } from '@core/layout/hierarchy-layout'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'

interface ScreenRing {
  key: string
  left: number
  top: number
  size: number
}

interface HierarchyLabelsProps {
  /** Hidden while the camera is moving to avoid extra compositor tiles during zoom. */
  hidden?: boolean
}

/** Subtle concentric ring guides — visual only; selection via pane hit-test in GraphCanvas. */
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
    const rings = getHierarchyRingLayers(
      snapshot.nodes,
      snapshot.edges,
      snapshot.entryNodeId,
      snapshot.positions,
      runtime,
      runtime.organizationMethod
    )
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
          left: sx - ring.radius * zoom,
          top: sy - ring.radius * zoom,
          size: ring.radius * 2 * zoom
        }))
      )
    }

    const schedule = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(project, 200)
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
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden hierarchy-labels-layer"
      aria-hidden
    >
      {screenRings.map((ring) => {
        const selected = selectedRingKey === ring.key
        return (
          <div
            key={ring.key}
            className={`absolute rounded-full border border-dashed transition-colors ${
              selected
                ? 'border-accent/55 bg-accent/[0.04] shadow-[0_0_0_1px_rgba(45,212,191,0.12)]'
                : 'border-slate-400/25'
            }`}
            style={{
              left: ring.left,
              top: ring.top,
              width: ring.size,
              height: ring.size
            }}
          />
        )
      })}
    </div>
  )
}
