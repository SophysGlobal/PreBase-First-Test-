import { RotateCcw } from 'lucide-react'
import { useSettingsStore } from '../../state/settings-store'
import { useNetworkControls } from '../../state/network-controls-store'
import { InfoTooltip } from '../ui/InfoTooltip'
import { VISIBLE_RELATED_CONNECTIONS_HELP } from '../../constants/graph-help'

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-text-secondary">
        <span>{label}</span>
        <span className="text-[10px] text-text-muted tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-400"
      />
    </div>
  )
}

/** Sidebar controls shown only in Network graph mode (Issue: settings live in sidebar). */
export function NetworkGraphSidebarPanel() {
  const visibleRelatedConnections = useSettingsStore((s) => s.visibleRelatedConnections)
  const setVisibleRelatedConnections = useSettingsStore((s) => s.setVisibleRelatedConnections)
  const edgeOpacity = useSettingsStore((s) => s.networkEdgeOpacity)
  const setEdgeOpacity = useSettingsStore((s) => s.setNetworkEdgeOpacity)

  const c = useNetworkControls()

  return (
    <div className="space-y-3 pt-0.5 border-t border-border-subtle">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-text-muted px-0.5">Network</p>
          <button
            type="button"
            onClick={c.requestResetView}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary px-1.5 py-0.5 rounded hover:bg-surface-muted transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset view
          </button>
        </div>

        <div className="space-y-1.5 px-0.5">
          <div className="flex items-center justify-between text-[11px] text-text-secondary">
            <span className="flex items-center gap-1">
              Related connections
              <InfoTooltip
                title={VISIBLE_RELATED_CONNECTIONS_HELP.title}
                body={VISIBLE_RELATED_CONNECTIONS_HELP.body}
                side="bottom"
              />
            </span>
            <span className="text-[10px] text-text-muted tabular-nums">
              {visibleRelatedConnections}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={visibleRelatedConnections}
            onChange={(e) => setVisibleRelatedConnections(Number(e.target.value) as 0 | 1 | 2)}
            className="w-full accent-teal-400"
          />
        </div>
      </div>

      <div className="space-y-2 px-0.5">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">Display</p>
        <Slider
          label="Node size"
          value={c.nodeScale}
          min={0.5}
          max={2.5}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(nodeScale) => c.set({ nodeScale })}
        />
        <Slider
          label="Edge thickness"
          value={c.linkWidth}
          min={0.2}
          max={2}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(linkWidth) => c.set({ linkWidth })}
        />
        <Slider
          label="Edge opacity"
          value={edgeOpacity}
          min={0.1}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setEdgeOpacity}
        />
        <label className="flex items-center justify-between text-[11px] text-text-secondary cursor-pointer py-0.5">
          <span>Directional arrows</span>
          <input
            type="checkbox"
            checked={c.showArrows}
            onChange={(e) => c.set({ showArrows: e.target.checked })}
            className="accent-teal-400"
          />
        </label>
      </div>

      <div className="space-y-2 px-0.5">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">Forces</p>
        <Slider
          label="Center pull"
          value={c.centerForce}
          min={0}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(centerForce) => c.set({ centerForce })}
        />
        <Slider
          label="Repulsion"
          value={-c.repelForce}
          min={20}
          max={400}
          step={10}
          format={(v) => String(v)}
          onChange={(v) => c.set({ repelForce: -v })}
        />
        <Slider
          label="Link distance"
          value={c.linkDistance}
          min={20}
          max={140}
          step={5}
          format={(v) => String(v)}
          onChange={(linkDistance) => c.set({ linkDistance })}
        />
      </div>
    </div>
  )
}
