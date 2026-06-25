import { useEffect, useMemo, useState } from 'react'
import { useStoreApi } from '@xyflow/react'
import { getPyramidDepthBands } from '@core/layout/hierarchy-layout'
import { depthLevelColor } from '@core/layout/layout-depth-colors'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'

interface ScreenBand {
  key: string
  depth: number
  top: number
  left: number
  width: number
  height: number
}

interface PyramidLabelsProps {
  hidden?: boolean
}

/** Colored horizontal depth bands for pyramid layout. */
export function PyramidLabels({ hidden = false }: PyramidLabelsProps) {
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const settings = useSettingsStore()
  const store = useStoreApi()
  const [bands, setBands] = useState<ScreenBand[]>([])

  const bandData = useMemo(() => {
    if (layoutMode !== 'pyramid' || !snapshot?.entryNodeId || !snapshot.positions) return null
    const runtime = layoutRuntimeFromSettings(settings)
    const bands = getPyramidDepthBands(
      snapshot.nodes,
      snapshot.edges,
      snapshot.entryNodeId,
      snapshot.positions,
      runtime,
      runtime.organizationMethod
    )
    if (bands.length === 0) return null

    const xs = Object.values(snapshot.positions).map((p) => p.x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs, minX) + LAYOUT_NODE_BOX.width
    const pad = 48
    return { bands, minX: minX - pad, width: maxX - minX + pad * 2 }
  }, [snapshot, layoutMode, settings])

  useEffect(() => {
    if (!bandData || hidden) {
      setBands([])
      return
    }

    let debounce = 0
    const project = () => {
      const [tx, ty, zoom] = store.getState().transform
      const { bands, minX, width } = bandData
      setBands(
        bands.map((b) => ({
          key: `depth-${b.depth}`,
          depth: b.depth,
          top: b.y * zoom + ty,
          left: minX * zoom + tx,
          width: width * zoom,
          height: b.height * zoom
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
  }, [bandData, hidden, store])

  if (hidden || !bandData || bands.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden pyramid-labels-layer transition-opacity duration-200"
      aria-hidden
    >
      {bands.map((band) => {
        const color = depthLevelColor(band.depth)
        return (
          <div
            key={band.key}
            className="absolute border-t border-b"
            style={{
              top: band.top,
              left: band.left,
              width: band.width,
              height: band.height,
              borderColor: color,
              backgroundColor: color.replace(/[\d.]+\)$/, '0.05)')
            }}
          />
        )
      })}
    </div>
  )
}
