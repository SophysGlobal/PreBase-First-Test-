import { motion, AnimatePresence } from 'framer-motion'
import { Circle, FileCode, X } from 'lucide-react'
import { getHierarchyRingLayers } from '@core/layout/hierarchy-layout'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'
import {
  organizationMethodLabel,
  ringLayerExplanation,
  ringLayerTitle
} from '../../utils/hierarchy-ring-metadata'

export function RingInspector() {
  const inspectorWidth = useSettingsStore((s) => s.inspectorPanelWidth)
  const settings = useSettingsStore()
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const selectedRingKey = useGraphStore((s) => s.selectedRingKey)
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen)
  const setSelectedRingKey = useGraphStore((s) => s.setSelectedRingKey)
  const setInspectorOpen = useGraphStore((s) => s.setInspectorOpen)
  const openFileInCodeView = useGraphStore((s) => s.openFileInCodeView)

  if (
    !snapshot ||
    !selectedRingKey ||
    !inspectorOpen ||
    layoutMode !== 'hierarchy' ||
    !snapshot.entryNodeId
  ) {
    return null
  }

  const runtime = layoutRuntimeFromSettings(settings)
  const layers = getHierarchyRingLayers(
    snapshot.nodes,
    snapshot.edges,
    snapshot.entryNodeId,
    snapshot.positions,
    runtime,
    runtime.organizationMethod
  )
  const layer = layers.find((l) => l.key === selectedRingKey)
  if (!layer) return null

  const method = runtime.organizationMethod
  const files = layer.nodeIds
    .map((id) => snapshot.nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n && n.kind !== 'folder')
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="absolute top-0 right-0 h-full border-l border-border-subtle bg-surface-raised z-40 isolate flex flex-col shadow-panel titlebar-no-drag"
        style={{ width: inspectorWidth }}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Circle className="w-4 h-4 text-accent/80 shrink-0" />
            <span className="text-sm font-medium truncate">
              {ringLayerTitle(layer.depth, layer.ringIndex)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRingKey(null)
              setInspectorOpen(false)
            }}
            className="p-1 rounded hover:bg-surface-muted text-text-muted"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 space-y-3 shrink-0 border-b border-border-subtle text-xs">
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                Organization method
              </p>
              <p className="text-text-secondary text-[11px]">{organizationMethodLabel(method)}</p>
            </section>
            <section className="rounded-lg bg-surface-overlay/60 border border-border-subtle px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                What this ring means
              </p>
              <p className="text-text-secondary leading-relaxed text-[11px]">
                {ringLayerExplanation(layer.depth, layer.ringIndex, method)}
              </p>
            </section>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md bg-surface-overlay/50 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-text-muted">Files</p>
                <p className="text-sm font-medium text-text-primary">{files.length}</p>
              </div>
              <div className="rounded-md bg-surface-overlay/50 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-text-muted">Depth</p>
                <p className="text-sm font-medium text-text-primary">{layer.depth}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll p-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 px-1">
              Files in this ring
            </p>
            <ul className="space-y-0.5">
              {files.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFileInCodeView(f.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] text-text-secondary hover:bg-surface-muted transition-colors"
                  >
                    <FileCode className="w-3 h-3 shrink-0 text-accent" />
                    <span className="truncate">{f.label}</span>
                  </button>
                </li>
              ))}
              {files.length === 0 && (
                <p className="text-[11px] text-text-muted px-2 py-1">No files in this ring</p>
              )}
            </ul>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
