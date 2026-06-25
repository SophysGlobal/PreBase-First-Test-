import { useMemo } from 'react'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { collectFileTypes } from '../../utils/file-type-colors'
import { ARCHITECTURE_EDGE_LEGEND_ITEMS } from '../../utils/architecture-edges'
import { useGraphViewportInsets } from '../graph-shared/useGraphViewportInsets'
import { GraphLegendShell, LegendChip, LegendSectionLabel } from '../graph-shared/GraphLegendShell'
import type { GraphNode } from '../../../../core/types'

export function ArchitectureGraphLegend({ nodes }: { nodes: GraphNode[] }) {
  const showLegend = useGraphStore((s) => s.showLegend)
  const collapsed = useGraphStore((s) => s.legendCollapsed)
  const setCollapsed = useGraphStore((s) => s.setLegendCollapsed)
  const dimAmount = useSettingsStore((s) => s.legendInteractionDimAmount)
  const { legendBottomPx, leftPx } = useGraphViewportInsets()

  const fileTypes = useMemo(
    () => collectFileTypes(nodes.filter((n) => n.kind !== 'folder').map((n) => n.path)),
    [nodes]
  )

  if (!showLegend) return null

  const dimOpacity = 1 - dimAmount / 100

  return (
    <div
      className="absolute z-[22] pointer-events-none graph-legend-overlay transition-[opacity,filter] duration-200 ease-out"
      style={{
        left: leftPx,
        bottom: legendBottomPx,
        ['--legend-dim-opacity' as string]: String(dimOpacity)
      }}
    >
      <GraphLegendShell
        title="Architecture"
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
        <LegendSectionLabel>Edges</LegendSectionLabel>
        {ARCHITECTURE_EDGE_LEGEND_ITEMS.map((item) => (
          <LegendChip key={item.label} color={item.color} label={item.label} dashed={item.dashed} />
        ))}
      </GraphLegendShell>
    </div>
  )
}
