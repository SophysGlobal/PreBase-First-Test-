import { useState } from 'react'
import { Save } from 'lucide-react'
import { useSettingsStore } from '../../state/settings-store'
import { useGraphStore } from '../../state/graph-store'

export function SidebarCustomizationPanel() {
  const settings = useSettingsStore()
  const graphViewMode = useGraphStore((s) => s.graphViewMode)
  const setGraphViewMode = useGraphStore((s) => s.setGraphViewMode)

  const [draft, setDraft] = useState({
    secondarySidebarWidth: settings.secondarySidebarWidth,
    secondarySidebarCollapsedWidth: settings.secondarySidebarCollapsedWidth,
    inspectorPanelWidth: settings.inspectorPanelWidth,
    sidebarMinWidth: settings.sidebarMinWidth,
    sidebarMaxWidth: settings.sidebarMaxWidth
  })
  const [saved, setSaved] = useState(false)

  const clampMain = (v: number) =>
    Math.min(draft.sidebarMaxWidth, Math.max(draft.sidebarMinWidth, v))

  const save = () => {
    const min = Math.min(draft.sidebarMinWidth, draft.sidebarMaxWidth)
    const max = Math.max(draft.sidebarMinWidth, draft.sidebarMaxWidth)
    settings.setSidebarMinWidth(min)
    settings.setSidebarMaxWidth(max)
    settings.setSecondarySidebarWidth(Math.min(max, Math.max(min, draft.secondarySidebarWidth)))
    settings.setSecondarySidebarCollapsedWidth(draft.secondarySidebarCollapsedWidth)
    settings.setInspectorPanelWidth(Math.min(max, Math.max(min, draft.inspectorPanelWidth)))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Sidebar customization"
        description="Adjust sidebar widths. Changes apply after Save."
      >
        <SliderRow
          label="Minimum width"
          value={draft.sidebarMinWidth}
          min={160}
          max={280}
          onChange={(v) => setDraft((d) => ({ ...d, sidebarMinWidth: v }))}
        />
        <SliderRow
          label="Maximum width"
          value={draft.sidebarMaxWidth}
          min={300}
          max={560}
          onChange={(v) => setDraft((d) => ({ ...d, sidebarMaxWidth: v }))}
        />
        <SliderRow
          label="Left sidebar width"
          value={draft.secondarySidebarWidth}
          min={draft.sidebarMinWidth}
          max={draft.sidebarMaxWidth}
          onChange={(v) => setDraft((d) => ({ ...d, secondarySidebarWidth: clampMain(v) }))}
        />
        <SliderRow
          label="Collapsed rail width"
          value={draft.secondarySidebarCollapsedWidth}
          min={32}
          max={56}
          onChange={(v) => setDraft((d) => ({ ...d, secondarySidebarCollapsedWidth: v }))}
        />
        <SliderRow
          label="Right (inspector) width"
          value={draft.inspectorPanelWidth}
          min={draft.sidebarMinWidth}
          max={draft.sidebarMaxWidth}
          onChange={(v) => setDraft((d) => ({ ...d, inspectorPanelWidth: clampMain(v) }))}
        />
        <div className="py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 text-xs font-medium transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          {saved && <span className="text-[11px] text-teal-400">Saved</span>}
        </div>
      </Panel>

      <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-text-primary">Live preview</p>
          <div className="flex gap-1 p-0.5 rounded-lg border border-border-subtle bg-surface-muted/40">
            <button
              type="button"
              onClick={() => setGraphViewMode('tree')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                graphViewMode === 'tree' ? 'bg-surface-muted text-text-primary' : 'text-text-muted'
              }`}
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => setGraphViewMode('network')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                graphViewMode === 'network'
                  ? 'bg-surface-muted text-text-primary'
                  : 'text-text-muted'
              }`}
            >
              Network
            </button>
          </div>
        </div>
        <div className="flex h-44 rounded-lg border border-border-subtle overflow-hidden bg-[#0d0e10]">
          <div
            className="shrink-0 border-r border-border-subtle bg-surface-raised/90 flex flex-col"
            style={{ width: draft.secondarySidebarWidth }}
          >
            <div className="h-7 border-b border-border-subtle px-2 flex items-center text-[9px] text-text-muted">
              Graph controls
            </div>
            <div className="flex-1 p-2 space-y-1">
              <div className="h-2 rounded bg-surface-muted/80 w-3/4" />
              <div className="h-2 rounded bg-surface-muted/60 w-1/2" />
              <div className="h-8 rounded bg-surface-muted/40 mt-2" />
            </div>
            <div className="h-px bg-border-subtle" />
            <div className="flex-1 p-2">
              <div className="text-[8px] text-text-muted mb-1">Explorer</div>
              <div className="h-1.5 rounded bg-accent/30 w-full mb-1" />
              <div className="h-1.5 rounded bg-surface-muted/50 w-2/3" />
            </div>
          </div>
          <div className="flex-1 relative flex items-center justify-center">
            <p className="text-[10px] text-text-muted">
              {graphViewMode === 'network' ? 'Network graph' : 'Architecture graph'}
            </p>
            <div
              className="absolute top-0 right-0 h-full border-l border-border-subtle bg-surface-raised/90"
              style={{ width: Math.min(draft.inspectorPanelWidth, 120) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 px-4">
        {children}
      </div>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="py-2.5 border-b border-border-subtle/60 last:border-0">
      <div className="flex justify-between text-sm text-text-primary mb-1">
        <span>{label}</span>
        <span className="text-[11px] text-text-muted tabular-nums">{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-400"
      />
    </div>
  )
}
