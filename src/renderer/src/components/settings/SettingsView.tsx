import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import type { LayoutMode } from '../../../../core/types'
import { LAYOUT_PRESETS } from '../../constants/graph-help'
import { useSettingsStore } from '../../state/settings-store'
import { useGraphStore } from '../../state/graph-store'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-overlay/50 p-4 space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsView() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const uiDensity = useSettingsStore((s) => s.uiDensity)
  const setUiDensity = useSettingsStore((s) => s.setUiDensity)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion)
  const defaultLayout = useSettingsStore((s) => s.defaultLayout)
  const setDefaultLayout = useSettingsStore((s) => s.setDefaultLayout)
  const initialZoom = useSettingsStore((s) => s.initialZoom)
  const setInitialZoom = useSettingsStore((s) => s.setInitialZoom)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const setEditorFontSize = useSettingsStore((s) => s.setEditorFontSize)
  const editorLineNumbers = useSettingsStore((s) => s.editorLineNumbers)
  const setEditorLineNumbers = useSettingsStore((s) => s.setEditorLineNumbers)
  const editorWordWrap = useSettingsStore((s) => s.editorWordWrap)
  const setEditorWordWrap = useSettingsStore((s) => s.setEditorWordWrap)
  const panSensitivity = useSettingsStore((s) => s.panSensitivity)
  const setPanSensitivity = useSettingsStore((s) => s.setPanSensitivity)
  const zoomSensitivity = useSettingsStore((s) => s.zoomSensitivity)
  const setZoomSensitivity = useSettingsStore((s) => s.setZoomSensitivity)
  const resetSettings = useSettingsStore((s) => s.resetSettings)

  const layoutMode = useGraphStore((s) => s.layoutMode)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto sidebar-scroll">
      <div className="max-w-xl w-full mx-auto p-8 space-y-6 titlebar-no-drag">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
          <p className="text-sm text-text-muted mt-1">
            Preferences for PreBase appearance, graph behavior, and the code viewer.
          </p>
        </div>

        <Section title="Appearance">
          <Row label="Theme">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
              className="text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1.5 text-text-primary"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </Row>
          <Row label="UI density">
            <select
              value={uiDensity}
              onChange={(e) => setUiDensity(e.target.value as typeof uiDensity)}
              className="text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1.5 text-text-primary"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </Row>
          <Row label="Reduce motion">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
              className="accent-teal-400"
            />
          </Row>
        </Section>

        <Section title="Graph">
          <Row label="Default layout">
            <select
              value={defaultLayout}
              onChange={(e) => {
                const mode = e.target.value as LayoutMode
                setDefaultLayout(mode)
                setLayoutMode(mode)
              }}
              className="text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1.5 text-text-primary max-w-[140px]"
            >
              {LAYOUT_PRESETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Row>
          <p className="text-[11px] text-text-muted">
            Current session layout: <span className="text-accent capitalize">{layoutMode}</span>
          </p>
          <Row label="Initial zoom">
            <input
              type="range"
              min={0.5}
              max={1.4}
              step={0.02}
              value={initialZoom}
              onChange={(e) => setInitialZoom(Number(e.target.value))}
              className="w-28 accent-teal-400"
            />
          </Row>
        </Section>

        <Section title="Editor">
          <Row label="Font size">
            <input
              type="number"
              min={11}
              max={20}
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(Number(e.target.value) || 13)}
              className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1 text-text-primary"
            />
          </Row>
          <Row label="Line numbers">
            <input
              type="checkbox"
              checked={editorLineNumbers}
              onChange={(e) => setEditorLineNumbers(e.target.checked)}
              className="accent-teal-400"
            />
          </Row>
          <Row label="Word wrap">
            <input
              type="checkbox"
              checked={editorWordWrap}
              onChange={(e) => setEditorWordWrap(e.target.checked)}
              className="accent-teal-400"
            />
          </Row>
        </Section>

        <Section title="Interaction">
          <Row label="Pan sensitivity">
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={panSensitivity}
              onChange={(e) => setPanSensitivity(Number(e.target.value))}
              className="w-28 accent-teal-400"
            />
          </Row>
          <Row label="Zoom sensitivity">
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={zoomSensitivity}
              onChange={(e) => setZoomSensitivity(Number(e.target.value))}
              className="w-28 accent-teal-400"
            />
          </Row>
        </Section>

        <button
          type="button"
          onClick={resetSettings}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset all settings
        </button>
      </div>
    </div>
  )
}
