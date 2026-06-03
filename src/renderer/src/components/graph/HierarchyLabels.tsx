import { useEffect, useMemo, useRef, useState } from 'react'
import { useStoreApi } from '@xyflow/react'
import { X } from 'lucide-react'
import {
  getHierarchyRingLabels,
  getPyramidLayerLabels,
  type HierarchyRingLabel
} from '@core/layout/hierarchy-layout'
import { layerExplanationForDepth } from '@core/layout/dependency-depth'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'
import { getVisibleNodeIds } from '../../utils/graph-visibility'

/**
 * Syncs the label layer transform to the React Flow viewport without React
 * re-renders on every zoom frame (useViewport() was causing whole-app flicker).
 */
function useViewportTransformRef() {
  const layerRef = useRef<HTMLDivElement>(null)
  const store = useStoreApi()

  useEffect(() => {
    const apply = (transform: [number, number, number]) => {
      const el = layerRef.current
      if (!el) return
      const [x, y, zoom] = transform
      el.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    }

    let last = store.getState().transform
    apply(last)

    return store.subscribe((state) => {
      const t = state.transform
      if (t[0] === last[0] && t[1] === last[1] && t[2] === last[2]) return
      last = t
      apply(t)
    })
  }, [store])

  return layerRef
}

export function HierarchyLabels() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const graphDepth = useGraphStore((s) => s.graphDepth)
  const layerVisibility = useGraphStore((s) => s.layerVisibility)
  const isolatedLayer = useGraphStore((s) => s.isolatedLayer)
  const hideLowImportance = useGraphStore((s) => s.hideLowImportance)
  const graphOrganizationMode = useGraphStore((s) => s.graphOrganizationMode)
  const expandedFolderIds = useGraphStore((s) => s.expandedFolderIds)
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const showHierarchyLabels = useSettingsStore((s) => s.showHierarchyLabels)
  const maxRenderedNodes = useSettingsStore((s) => s.maxRenderedNodes)
  const settings = useSettingsStore()
  const layerRef = useViewportTransformRef()
  const [selectedDepth, setSelectedDepth] = useState<number | null>(null)

  const visibleNodeIds = useMemo(() => {
    if (!snapshot) return new Set<string>()
    return getVisibleNodeIds(snapshot, {
      graphDepth,
      layerVisibility,
      isolatedLayer,
      focusNeighborhood: false,
      hideLowImportance,
      focusedNodeId,
      selectedNodeId,
      graphOrganizationMode,
      expandedFolderIds,
      maxRenderedNodes
    })
  }, [
    snapshot,
    graphDepth,
    layerVisibility,
    isolatedLayer,
    hideLowImportance,
    focusedNodeId,
    selectedNodeId,
    graphOrganizationMode,
    expandedFolderIds,
    maxRenderedNodes
  ])

  const labels = useMemo(() => {
    if (!showHierarchyLabels || !snapshot?.entryNodeId) return []
    const runtime = layoutRuntimeFromSettings(settings)

    if (layoutMode === 'hierarchy') {
      return getHierarchyRingLabels(
        snapshot.nodes,
        snapshot.edges,
        snapshot.entryNodeId,
        runtime,
        visibleNodeIds
      )
    }
    if (layoutMode === 'pyramid') {
      return getPyramidLayerLabels(
        snapshot.nodes,
        snapshot.edges,
        snapshot.entryNodeId,
        runtime,
        visibleNodeIds
      )
    }
    return []
  }, [snapshot, layoutMode, showHierarchyLabels, settings, visibleNodeIds])

  const selectedInfo =
    selectedDepth !== null ? layerExplanationForDepth(selectedDepth) : null

  if (labels.length === 0) return null

  const isPyramid = layoutMode === 'pyramid'

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden hierarchy-labels-layer"
        aria-hidden={false}
      >
        <div ref={layerRef} style={{ transformOrigin: '0 0' }}>
          {labels.map((label) => {
            const ringLabel = label as HierarchyRingLabel
            const showRing =
              !isPyramid && layoutMode === 'hierarchy' && ringLabel.radius > 0
            const active = selectedDepth === label.depth

            return (
              <div key={`${layoutMode}-${label.depth}`}>
                {showRing && (
                  <div
                    className="absolute rounded-full border border-teal-500/10 pointer-events-none"
                    style={{
                      left: 0,
                      top: 0,
                      width: Math.min(ringLabel.radius, 360) * 2,
                      height: Math.min(ringLabel.radius, 360) * 2,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}
                <button
                  type="button"
                  title="Click for layer explanation"
                  onClick={() =>
                    setSelectedDepth((d) => (d === label.depth ? null : label.depth))
                  }
                  className={`absolute px-2 py-0.5 rounded-md text-[9px] tracking-wide whitespace-nowrap pointer-events-auto cursor-pointer transition-colors titlebar-no-drag ${
                    active
                      ? 'text-teal-200 bg-teal-500/20 border border-teal-400/50'
                      : 'text-text-muted/90 bg-surface-overlay/65 border border-border-subtle/50 hover:border-teal-400/40 hover:text-text-secondary'
                  }`}
                  style={{
                    left: label.x,
                    top: label.y,
                    transform: 'translate(-50%, -100%)'
                  }}
                >
                  {label.label}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {selectedInfo && (
        <div
          className="absolute top-20 right-4 z-[12] w-64 rounded-xl border border-border-subtle bg-surface-overlay shadow-xl titlebar-no-drag"
          role="dialog"
          aria-label={selectedInfo.title}
        >
          <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-border-subtle/60">
            <div>
              <p className="text-xs font-semibold text-text-primary">{selectedInfo.title}</p>
              <p className="text-[10px] text-text-muted mt-0.5">Dependency depth</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDepth(null)}
              className="p-1 rounded hover:bg-surface-muted text-text-muted"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="px-3 py-2.5 text-[11px] text-text-secondary leading-relaxed">
            {selectedInfo.body}
          </p>
        </div>
      )}
    </>
  )
}
