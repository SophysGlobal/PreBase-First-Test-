import {
  ChevronDown,
  ChevronRight,
  FileCode,
  GitBranch,
  Layers,
  LayoutGrid,
  Map,
  Search,
  SlidersHorizontal
} from 'lucide-react'
import { useState } from 'react'
import type { LayoutMode } from '../../../../core/types'
import { useGraphStore, type FilterKind } from '../../state/graph-store'
import { GraphLayersPanel } from './GraphLayersPanel'
import { InfoTooltip } from '../ui/InfoTooltip'
import { CollapsibleSidebar } from '../layout/CollapsibleSidebar'
import { DEPTH_HELP, LAYOUT_MODE_HELP, LAYOUT_PRESETS } from '../../constants/graph-help'

const filters: { id: FilterKind; label: string; icon: typeof FileCode }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'files', label: 'Files', icon: FileCode },
  { id: 'components', label: 'Components', icon: Layers },
  { id: 'imports', label: 'Dependencies', icon: GitBranch }
]

interface GraphSidebarProps {
  onRelayout: (mode: LayoutMode) => void
}

export function GraphSidebar({ onRelayout }: GraphSidebarProps) {
  const collapsed = useGraphStore((s) => s.secondarySidebarCollapsed)
  const toggle = useGraphStore((s) => s.toggleSecondarySidebar)
  const filter = useGraphStore((s) => s.filter)
  const setFilter = useGraphStore((s) => s.setFilter)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery)
  const graphDepth = useGraphStore((s) => s.graphDepth)
  const setGraphDepth = useGraphStore((s) => s.setGraphDepth)
  const showLegend = useGraphStore((s) => s.showLegend)
  const setShowLegend = useGraphStore((s) => s.setShowLegend)
  const showMinimap = useGraphStore((s) => s.showMinimap)
  const setShowMinimap = useGraphStore((s) => s.setShowMinimap)
  const showFolders = useGraphStore((s) => s.showFolders)
  const setShowFolders = useGraphStore((s) => s.setShowFolders)
  const layoutModeValue = useGraphStore((s) => s.layoutMode)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)

  const [layoutOpen, setLayoutOpen] = useState(false)

  return (
    <CollapsibleSidebar
      collapsed={collapsed}
      onToggle={toggle}
      title="Graph"
      railIcon={<SlidersHorizontal className="w-4 h-4" />}
    >
      <div className="p-2 space-y-2.5 pb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
          />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 px-0.5">
            Filter
          </p>
          <div className="flex flex-wrap gap-1">
            {filters.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                  filter === id
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-muted hover:bg-surface-muted'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <GraphLayersPanel />

        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 px-0.5 flex items-center gap-1">
            Depth
            <InfoTooltip title={DEPTH_HELP.title} body={DEPTH_HELP.body} side="bottom" />
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, -1].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setGraphDepth(d)}
                className={`flex-1 py-1 rounded text-[10px] transition-colors ${
                  graphDepth === d
                    ? 'bg-accent-soft text-accent'
                    : 'bg-surface-muted text-text-muted'
                }`}
              >
                {d < 0 ? 'All' : d}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border-subtle rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setLayoutOpen((v) => !v)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-text-muted hover:bg-surface-muted/40 transition-colors"
          >
            Layout
            {layoutOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          {layoutOpen && (
            <div className="px-2 pb-2 space-y-0.5">
              {LAYOUT_PRESETS.map((mode) => (
                <div key={mode} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutMode(mode)
                      onRelayout(mode)
                    }}
                    className={`flex-1 px-2 py-1 rounded text-[10px] capitalize transition-colors text-left ${
                      layoutModeValue === mode
                        ? 'bg-accent-soft text-accent'
                        : 'text-text-muted hover:bg-surface-muted'
                    }`}
                  >
                    {mode}
                  </button>
                  <InfoTooltip
                    title={LAYOUT_MODE_HELP[mode].title}
                    body={LAYOUT_MODE_HELP[mode].body}
                    side="right"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1 pt-0.5 border-t border-border-subtle">
          <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer py-0.5">
            <span className="flex items-center gap-1.5">
              <Map className="w-3 h-3" /> Legend
            </span>
            <input
              type="checkbox"
              checked={showLegend}
              onChange={(e) => setShowLegend(e.target.checked)}
              className="accent-teal-400"
            />
          </label>
          <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer py-0.5">
            <span>Minimap</span>
            <input
              type="checkbox"
              checked={showMinimap}
              onChange={(e) => setShowMinimap(e.target.checked)}
              className="accent-teal-400"
            />
          </label>
          <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer py-0.5">
            <span>Folder nodes</span>
            <input
              type="checkbox"
              checked={showFolders}
              onChange={(e) => setShowFolders(e.target.checked)}
              className="accent-teal-400"
            />
          </label>
        </div>
      </div>
    </CollapsibleSidebar>
  )
}
