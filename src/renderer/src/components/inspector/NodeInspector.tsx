import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Code2,
  FileCode,
  Layers,
  PanelRightOpen,
  Star,
  X
} from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { getNodeInspectorData } from '../../utils/graph-metadata'
import { inferFileDescription } from '../../utils/file-description'

export function NodeInspector() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setInspectorOpen = useGraphStore((s) => s.setInspectorOpen)
  const openFileInCodeView = useGraphStore((s) => s.openFileInCodeView)

  if (!snapshot || !selectedNodeId || !inspectorOpen) return null

  const data = getNodeInspectorData(snapshot, selectedNodeId)
  if (!data) return null

  const { node, incoming, outgoing, incomingLabels, outgoingLabels } = data
  const isEntry = node.isEntry || node.id === snapshot.entryNodeId
  const description = inferFileDescription(node)

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="absolute top-0 right-0 h-full w-80 border-l border-border-subtle bg-surface-raised/92 backdrop-blur-xl z-30 flex flex-col shadow-panel titlebar-no-drag"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {node.kind === 'component' ? (
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            ) : (
              <FileCode className="w-4 h-4 text-accent shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{node.label}</span>
            {isEntry && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </div>
          <button
            onClick={() => {
              setSelectedNodeId(null)
              setInspectorOpen(false)
            }}
            className="p-1 rounded hover:bg-surface-muted text-text-muted"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-border-subtle space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => openFileInCodeView(node.id)}
            disabled={!node.path}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white text-surface text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 transition-colors"
          >
            <Code2 className="w-4 h-4" />
            Open in Code View
          </button>
          <p className="text-[10px] text-text-muted text-center flex items-center justify-center gap-1">
            <PanelRightOpen className="w-3 h-3" />
            Right-click any node for quick actions
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <section className="rounded-lg bg-surface-overlay/60 border border-border-subtle px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">About</p>
            <p className="text-text-secondary leading-relaxed text-[11px]">{description}</p>
          </section>

          {node.path && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Path</p>
              <p className="text-text-secondary font-mono text-[11px] break-all">{node.path}</p>
            </section>
          )}

          {node.meta?.architectureLayer && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Layer</p>
              <span className="inline-flex px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-[10px] capitalize">
                {node.meta.architectureLayer}
              </span>
            </section>
          )}

          <section className="grid grid-cols-2 gap-2">
            <Stat label="Imports" value={outgoing.length} />
            <Stat label="Used by" value={incoming.length} />
            <Stat label="Functions" value={node.meta?.functionCount ?? 0} />
            <Stat label="Components" value={node.meta?.componentCount ?? 0} />
          </section>

          {node.meta?.exports && node.meta.exports.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Exports</p>
              <div className="flex flex-wrap gap-1">
                {node.meta.exports.slice(0, 12).map((e) => (
                  <span
                    key={e}
                    className="px-1.5 py-0.5 rounded bg-surface-muted text-text-secondary text-[10px]"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </section>
          )}

          {outgoingLabels.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Imports
              </p>
              <ul className="space-y-1">
                {outgoingLabels.slice(0, 15).map((l) => (
                  <li key={l} className="text-text-secondary truncate">
                    {l}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {incomingLabels.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3" /> Dependents
              </p>
              <ul className="space-y-1">
                {incomingLabels.slice(0, 15).map((l) => (
                  <li key={l} className="text-text-secondary truncate">
                    {l}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2.5 py-2 rounded-lg bg-surface-overlay border border-border-subtle">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  )
}
