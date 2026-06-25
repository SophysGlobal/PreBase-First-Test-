import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '../../state/graph-store'
import { GraphZoomControls } from '../../features/graph-shared/GraphZoomControls'

interface GraphToolbarProps {
  onRelayout: () => void
}

export function GraphToolbar({ onRelayout }: GraphToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const snapshot = useGraphStore((s) => s.snapshot)

  if (!snapshot) return null

  return (
    <GraphZoomControls
      onZoomIn={() => zoomIn({ duration: 200 })}
      onZoomOut={() => zoomOut({ duration: 200 })}
      onFitView={() => fitView({ padding: 0.2, duration: 400 })}
      onRelayout={onRelayout}
    />
  )
}
