import { motion, AnimatePresence } from 'framer-motion'
import { Circle, FileCode, Layers, X } from 'lucide-react'
import { getHierarchyRingBandsForSnapshot, getPyramidDepthBands } from '@core/layout/hierarchy-layout'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'
import { getEffectiveGraphPositions } from '../../utils/effective-graph-positions'
import {
  organizationMethodLabel,
  pyramidLayerExplanation,
  pyramidLayerTitle,
  ringLayerExplanation,
  ringLayerTitle
} from '../../utils/hierarchy-ring-metadata'

export function RingInspector() {
  const inspectorWidth = useSettingsStore((s) => s.inspectorPanelWidth)
  const settings = useSettingsStore()
  const snapshot = useGraphStore((s) => s.snapshot)
  const userPositions = useGraphStore((s) => s.userPositions)
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
    (layoutMode !== 'hierarchy' && layoutMode !== 'pyramid') ||
    !snapshot.entryNodeId
  ) {
    return null
  }

  const runtime = layoutRuntimeFromSettings(settings)
  const positions = getEffectiveGraphPositions(snapshot, userPositions)

  let title = ''
  let explanation = ''
  let depth = 0
  let ringIndex = 0
  let fileIds: string[] = []

  if (layoutMode === 'hierarchy') {
    const bands = getHierarchyRingBandsForSnapshot(
      snapshot.nodes,
      snapshot.edges,
      snapshot.entryNodeId,
      positions,
      runtime
    )
    const layer = bands.find((b) => b.key === selectedRingKey)
    if (!layer) return null
    title = ringLayerTitle(
      layer.semanticDepth,
      layer.subRingIndex,
      bands.filter((b) => b.semanticDepth === layer.semanticDepth).length
    )
    explanation = ringLayerExplanation(layer.semanticDepth, layer.subRingIndex)
    depth = layer.semanticDepth
    ringIndex = layer.subRingIndex
    fileIds = layer.nodeIds
  } else {
    const bands = getPyramidDepthBands(
      snapshot.nodes,
      snapshot.edges,
      snapshot.entryNodeId,
      positions,
      runtime
    )
    const band = bands.find((b) => b.key === selectedRingKey)
    if (!band) return null
    title = pyramidLayerTitle(band.depth)
    explanation = pyramidLayerExplanation(band.depth)
    depth = band.depth
    fileIds = band.nodeIds
  }

  const files = fileIds
    .map((id) => snapshot.nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n && n.kind !== 'folder')
    .sort((a, b) => a.label.localeCompare(b.label))

  const Icon = layoutMode === 'pyramid' ? Layers : Circle

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
            <Icon className="w-4 h-4 text-accent/80 shrink-0" />
            <span className="text-sm font-medium truncate">{title}</span>
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
                Layout mode
              </p>
              <p className="text-text-secondary text-[11px] capitalize">{layoutMode}</p>
            </section>
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                Organization method
              </p>
              <p className="text-text-secondary text-[11px]">{organizationMethodLabel()}</p>
            </section>
            <section className="rounded-lg bg-surface-overlay/60 border border-border-subtle px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                {layoutMode === 'pyramid' ? 'What this depth group means' : 'What this ring means'}
              </p>
              <p className="text-text-secondary leading-relaxed text-[11px]">{explanation}</p>
            </section>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md bg-surface-overlay/50 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-text-muted">Files</p>
                <p className="text-sm font-medium text-text-primary">{files.length}</p>
              </div>
              <div className="rounded-md bg-surface-overlay/50 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-text-muted">Depth</p>
                <p className="text-sm font-medium text-text-primary">
                  {depth >= 10_000 ? '—' : depth}
                </p>
              </div>
              {layoutMode === 'hierarchy' && ringIndex > 0 && (
                <div className="rounded-md bg-surface-overlay/50 px-2 py-1.5 col-span-2">
                  <p className="text-[9px] uppercase tracking-wider text-text-muted">Sub-ring</p>
                  <p className="text-sm font-medium text-text-primary">
                    {String.fromCharCode(65 + ringIndex)} (same depth level)
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll p-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 px-1">
              {layoutMode === 'pyramid' ? 'Files in this group' : 'Files in this ring'}
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
                <p className="text-[11px] text-text-muted px-2 py-1">No files in this group</p>
              )}
            </ul>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
