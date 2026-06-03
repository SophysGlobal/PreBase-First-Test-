import { useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { ARCHITECTURE_EDGE_LEGEND, collectFileTypes } from '../../utils/file-type-colors'
import type { GraphNode } from '../../../../core/types'

interface LegendChipProps {
  color: string
  label: string
  dashed?: boolean
}

function LegendChip({ color, label, dashed }: LegendChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-muted/50 border border-border-subtle/60 shrink-0">
      {dashed ? (
        <span className="w-4 h-0 border-t-2 border-dashed shrink-0" style={{ borderColor: color }} />
      ) : (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="text-[10px] text-text-secondary whitespace-nowrap">{label}</span>
    </span>
  )
}

function LegendShell({
  title,
  collapsed,
  onToggle,
  children
}: {
  title: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="pointer-events-auto max-w-[min(100%,920px)]">
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border-subtle bg-[#141518]/95 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary shrink-0"
        >
          {title}
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        {!collapsed && (
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">{children}</div>
        )}
      </div>
    </div>
  )
}

export function ArchitectureGraphLegend({ nodes }: { nodes: GraphNode[] }) {
  const showLegend = useGraphStore((s) => s.showLegend)
  const collapsed = useGraphStore((s) => s.legendCollapsed)
  const setCollapsed = useGraphStore((s) => s.setLegendCollapsed)

  const fileTypes = useMemo(
    () => collectFileTypes(nodes.filter((n) => n.kind !== 'folder').map((n) => n.path)),
    [nodes]
  )

  if (!showLegend) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[18] pointer-events-none px-3 w-full flex justify-center">
      <LegendShell
        title="Architecture"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        {fileTypes.slice(0, 12).map((t) => (
          <LegendChip key={t.id} color={t.color} label={t.name} />
        ))}
        <span className="w-px h-4 bg-border-subtle shrink-0 mx-0.5" />
        {ARCHITECTURE_EDGE_LEGEND.map((e) => (
          <LegendChip key={e.id} color={e.color} label={e.label} dashed={e.dashed} />
        ))}
      </LegendShell>
    </div>
  )
}

export function NetworkGraphLegend({ nodes }: { nodes: GraphNode[] }) {
  const showLegend = useGraphStore((s) => s.showLegend)
  const collapsed = useGraphStore((s) => s.networkLegendCollapsed)
  const setCollapsed = useGraphStore((s) => s.setNetworkLegendCollapsed)

  const fileTypes = useMemo(
    () => collectFileTypes(nodes.filter((n) => n.kind !== 'folder').map((n) => n.path)),
    [nodes]
  )

  if (!showLegend) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[18] pointer-events-none px-3 w-full flex justify-center">
      <LegendShell
        title="Network"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        {fileTypes.slice(0, 14).map((t) => (
          <LegendChip key={t.id} color={t.color} label={t.name} />
        ))}
        <span className="w-px h-4 bg-border-subtle shrink-0 mx-0.5" />
        <LegendChip color="rgba(180,180,195,0.5)" label="Import" />
        <LegendChip color="#2dd4bf" label="Selected" />
        <LegendChip color="#e8b84a" label="Entry" />
      </LegendShell>
    </div>
  )
}
