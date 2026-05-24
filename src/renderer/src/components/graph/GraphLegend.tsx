import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { InfoTooltip } from '../ui/InfoTooltip'
import { EDGE_TYPE_HELP } from '../../constants/graph-help'

const NODE_ITEMS = [
  { color: '#f59e0b', label: 'Entry point' },
  { color: '#a78bfa', label: 'React component' },
  { color: '#6366f1', label: 'Module / file' },
  { color: '#34d399', label: 'Service' },
  { color: '#71717a', label: 'External module' }
]

const EDGE_ITEMS = [
  { color: 'rgba(255,255,255,0.28)', label: 'Static import', dashed: false },
  { color: 'rgba(99,102,241,0.5)', label: 'Focused / related', dashed: false },
  { color: 'rgba(168,85,247,0.55)', label: 'Dynamic import', dashed: true },
  { color: 'rgba(245,158,11,0.9)', label: 'Selected edge', dashed: false }
]

const EDGES_HELP_BODY = EDGE_TYPE_HELP.map((e) => `${e.label}: ${e.body}`).join(' ')

export function GraphLegend() {
  const showLegend = useGraphStore((s) => s.showLegend)
  const collapsed = useGraphStore((s) => s.legendCollapsed)
  const setCollapsed = useGraphStore((s) => s.setLegendCollapsed)

  if (!showLegend) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 left-4 z-20 max-w-[220px]"
    >
      <div className="rounded-xl border border-border-subtle bg-surface-overlay/75 backdrop-blur-md shadow-panel overflow-hidden">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-medium text-text-secondary hover:bg-surface-muted/50 transition-colors"
        >
          <span>Legend</span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3 pb-3 space-y-2.5"
            >
              <motion.div>
                <p className="text-[9px] uppercase tracking-wider text-text-muted mb-1.5">Nodes</p>
                <div className="space-y-1">
                  {NODE_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] text-text-secondary">{item.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                  Edges
                  <InfoTooltip title="Edge types" body={EDGES_HELP_BODY} side="right" />
                </p>
                <div className="space-y-1">
                  {EDGE_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span
                        className="w-6 h-0 shrink-0 block"
                        style={{
                          height: 0,
                          borderTop: item.dashed
                            ? `2px dashed ${item.color}`
                            : `2px solid ${item.color}`
                        }}
                      />
                      <span className="text-[10px] text-text-secondary">{item.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-text-muted mt-2 leading-relaxed">
                  Arrows flow importer → imported module
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
