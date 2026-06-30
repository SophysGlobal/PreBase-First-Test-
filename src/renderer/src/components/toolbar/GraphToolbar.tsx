import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { GraphZoomControls } from '../../features/graph-shared/GraphZoomControls'
import { architectureFitViewOptions } from '../../utils/graph-viewport-fit'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'

interface GraphToolbarProps {
  onRelayout: () => void
}

export function GraphToolbar({ onRelayout }: GraphToolbarProps) {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow()
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const selectedRingKey = useGraphStore((s) => s.selectedRingKey)
  const initialZoom = useSettingsStore((s) => s.initialZoom)
  const inspectorWidth = useSettingsStore((s) => s.inspectorPanelWidth)
  const userPositions = useGraphStore((s) => s.userPositions)
  const settings = useSettingsStore()

  if (!snapshot) return null

  const handleFitView = () => {
    const rightInset =
      inspectorOpen && (selectedNodeId !== null || selectedRingKey !== null) ? inspectorWidth : 0
    const runtime = layoutRuntimeFromSettings(settings)
    const fitOpts = architectureFitViewOptions(
      layoutMode,
      { rightPx: rightInset, bottomPx: 72 },
      initialZoom,
      snapshot,
      runtime,
      userPositions
    )
    void fitView({
      nodes: getNodes(),
      padding: fitOpts.padding,
      minZoom: fitOpts.minZoom,
      maxZoom: fitOpts.maxZoom,
      duration: 400
    })
  }

  return (
    <GraphZoomControls
      onZoomIn={() => zoomIn({ duration: 200 })}
      onZoomOut={() => zoomOut({ duration: 200 })}
      onFitView={handleFitView}
      onRelayout={onRelayout}
    />
  )
}
