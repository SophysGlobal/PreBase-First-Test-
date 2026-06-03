import { Maximize2, Minus, Plus, RefreshCw } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '../../state/graph-store'

interface GraphToolbarProps {
  onRelayout: () => void
}

export function GraphToolbar({ onRelayout }: GraphToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const snapshot = useGraphStore((s) => s.snapshot)

  if (!snapshot) return null

  return (
    <div className="absolute top-4 right-4 flex items-center gap-1 p-1 rounded-xl bg-surface-overlay/90 border border-border-subtle bg-surface-overlay/95 z-10">
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="p-2 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors"
        title="Zoom in"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="p-2 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors"
        title="Zoom out"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={() => fitView({ padding: 0.2, duration: 400 })}
        className="p-2 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors"
        title="Fit view"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-border-subtle mx-0.5" />
      <button
        onClick={onRelayout}
        className="p-2 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors"
        title="Re-layout graph"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  )
}
