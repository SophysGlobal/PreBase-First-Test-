import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'

/** Shared spacing for lower-left floating graph controls (legend + zoom). */
export const GRAPH_FLOAT_LEFT_PX = 20
export const GRAPH_FLOAT_BOTTOM_PX = 20
export const GRAPH_ZOOM_BAR_HEIGHT_PX = 46
export const GRAPH_FLOAT_GAP_PX = 12

/** Layout-aware insets for floating graph UI (legend, zoom, Magnus). */
export function useGraphViewportInsets() {
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const selectedRingKey = useGraphStore((s) => s.selectedRingKey)
  const inspectorWidth = useSettingsStore((s) => s.inspectorPanelWidth)

  const rightPanelOpen =
    inspectorOpen && (selectedNodeId !== null || selectedRingKey !== null)
  const rightInset = rightPanelOpen ? inspectorWidth : 0

  return {
    rightInset,
    leftPx: GRAPH_FLOAT_LEFT_PX,
    magnusRightPx: rightInset + 24,
    zoomBottomPx: GRAPH_FLOAT_BOTTOM_PX,
    legendBottomPx: GRAPH_FLOAT_BOTTOM_PX + GRAPH_ZOOM_BAR_HEIGHT_PX + GRAPH_FLOAT_GAP_PX
  }
}
