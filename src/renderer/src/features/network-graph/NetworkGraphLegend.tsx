import { useMemo } from 'react'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { collectFileTypes } from '../../utils/file-type-colors'
import { getEdgeCategoryDefinition } from '../../utils/edge-categories'
import { useGraphViewportInsets } from '../graph-shared/useGraphViewportInsets'
import { GraphLegendShell, LegendChip, LegendSectionLabel } from '../graph-shared/GraphLegendShell'
import type { GraphNode } from '../../../../core/types'

export function NetworkGraphLegend({ nodes }: { nodes: GraphNode[] }) {
  const showLegend = useGraphStore((s) => s.showLegend)
  const collapsed = useGraphStore((s) => s.networkLegendCollapsed)
  const setCollapsed = useGraphStore((s) => s.setNetworkLegendCollapsed)
  const visibleEdgeCategories = useSettingsStore((s) => s.visibleEdgeCategories)
  const { legendBottomPx, leftPx } = useGraphViewportInsets()

  const fileTypes = useMemo(
    () => collectFileTypes(nodes.filter((n) => n.kind !== 'folder').map((n) => n.path)),
    [nodes]
  )

  if (!showLegend) return null

  return (
    <div
      className="absolute z-[22] pointer-events-none graph-legend-overlay"
      style={{ left: leftPx, bottom: legendBottomPx }}
    >
      <GraphLegendShell
        title="Network"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        {fileTypes.length > 0 && (
          <>
            <LegendSectionLabel>File types</LegendSectionLabel>
            {fileTypes.slice(0, 8).map((t) => (
              <LegendChip key={t.id} color={t.color} label={t.name} />
            ))}
          </>
        )}
        <LegendSectionLabel>Visible edges</LegendSectionLabel>
        {visibleEdgeCategories.map((id) => {
          const cat = getEdgeCategoryDefinition(id)
          return <LegendChip key={id} color={cat.color} label={cat.shortLabel} />
        })}
        <LegendChip color="#2dd4bf" label="Selected" />
        <LegendChip color="#e8b84a" label="Entry" />
      </GraphLegendShell>
    </div>
  )
}
