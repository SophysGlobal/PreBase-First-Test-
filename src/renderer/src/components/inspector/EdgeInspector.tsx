import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, GitBranch, X } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { getEdgeInspectorData } from '../../utils/graph-metadata'

export function EdgeInspector() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId)
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId)

  if (!snapshot || !selectedEdgeId) return null

  const data = getEdgeInspectorData(snapshot, selectedEdgeId)
  if (!data) return null

  const { edge, sourceNode, targetNode, description, reason } = data
  const specifiers = edge.meta?.specifiers?.filter((s) => s !== 'require') ?? []

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-[min(420px,90vw)] rounded-xl border border-border-subtle bg-surface-overlay/95 shadow-panel p-4"
      >
        <motion.div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-accent">
            <GitBranch className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Dependency</span>
          </div>
          <button
            onClick={() => setSelectedEdgeId(null)}
            className="p-1 rounded hover:bg-surface-muted text-text-muted"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        <div className="flex items-center gap-2 text-sm mb-2 flex-wrap">
          <span className="font-medium text-text-primary">{sourceNode.label}</span>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-medium text-text-primary">{targetNode.label}</span>
        </div>

        <p className="text-xs text-text-secondary mb-3">{description}</p>

        <div className="rounded-lg bg-surface-muted/50 border border-border-subtle px-3 py-2 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Why</p>
          <p className="text-xs text-text-secondary leading-relaxed">{reason}</p>
        </div>

        {specifiers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {specifiers.map((s) => (
              <span
                key={s}
                className="px-1.5 py-0.5 rounded bg-accent-soft text-accent text-[10px]"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {edge.meta?.line && (
          <p className="text-[10px] text-text-muted mt-2">Line {edge.meta.line}</p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
