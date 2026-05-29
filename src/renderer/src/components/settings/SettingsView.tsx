import { useState, type ReactNode } from 'react'
import {
  Info,
  Layers,
  Monitor,
  MousePointer2,
  Pencil,
  RotateCcw,
  Sparkles,
  Workflow
} from 'lucide-react'
import type { LayoutMode } from '../../../../core/types'
import { APP_NAME, APP_VERSION, SUPPORTED_LANGUAGES } from '../../../../core/constants/supported-languages'
import { LAYOUT_PRESETS } from '../../constants/graph-help'
import { useSettingsStore } from '../../state/settings-store'
import { useGraphStore } from '../../state/graph-store'

type SettingsCategory = 'appearance' | 'graph' | 'editor' | 'interaction' | 'performance' | 'about'

const CATEGORIES: {
  id: SettingsCategory
  label: string
  icon: typeof Monitor
}[] = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'graph', label: 'Graph', icon: Workflow },
  { id: 'editor', label: 'Editor', icon: Pencil },
  { id: 'interaction', label: 'Interaction', icon: MousePointer2 },
  { id: 'performance', label: 'Performance', icon: Sparkles },
  { id: 'about', label: 'About', icon: Info }
]

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5 border-b border-border-subtle/60 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{label}</p>
        {hint && <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 px-4">{children}</div>
    </div>
  )
}

function selectClass() {
  return 'text-xs rounded-lg bg-surface-muted border border-border-subtle px-2.5 py-1.5 text-text-primary min-w-[120px]'
}

export function SettingsView() {
  const [category, setCategory] = useState<SettingsCategory>('appearance')

  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const uiDensity = useSettingsStore((s) => s.uiDensity)
  const setUiDensity = useSettingsStore((s) => s.setUiDensity)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion)
  const defaultLayout = useSettingsStore((s) => s.defaultLayout)
  const setDefaultLayout = useSettingsStore((s) => s.setDefaultLayout)
  const showEdgeLabels = useSettingsStore((s) => s.showEdgeLabels)
  const setShowEdgeLabels = useSettingsStore((s) => s.setShowEdgeLabels)
  const showHierarchyLabels = useSettingsStore((s) => s.showHierarchyLabels)
  const setShowHierarchyLabels = useSettingsStore((s) => s.setShowHierarchyLabels)
  const initialZoom = useSettingsStore((s) => s.initialZoom)
  const setInitialZoom = useSettingsStore((s) => s.setInitialZoom)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const setEditorFontSize = useSettingsStore((s) => s.setEditorFontSize)
  const editorLineNumbers = useSettingsStore((s) => s.editorLineNumbers)
  const setEditorLineNumbers = useSettingsStore((s) => s.setEditorLineNumbers)
  const editorWordWrap = useSettingsStore((s) => s.editorWordWrap)
  const setEditorWordWrap = useSettingsStore((s) => s.setEditorWordWrap)
  const editorMinimap = useSettingsStore((s) => s.editorMinimap)
  const setEditorMinimap = useSettingsStore((s) => s.setEditorMinimap)
  const panSensitivity = useSettingsStore((s) => s.panSensitivity)
  const setPanSensitivity = useSettingsStore((s) => s.setPanSensitivity)
  const zoomSensitivity = useSettingsStore((s) => s.zoomSensitivity)
  const setZoomSensitivity = useSettingsStore((s) => s.setZoomSensitivity)
  const nodeDragDelayMs = useSettingsStore((s) => s.nodeDragDelayMs)
  const setNodeDragDelayMs = useSettingsStore((s) => s.setNodeDragDelayMs)
  const graphQuality = useSettingsStore((s) => s.graphQuality)
  const setGraphQuality = useSettingsStore((s) => s.setGraphQuality)
  const resetSettings = useSettingsStore((s) => s.resetSettings)

  const layoutMode = useGraphStore((s) => s.layoutMode)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)

  const graphLanguages = SUPPORTED_LANGUAGES.filter((l) => l.graphImports)

  return (
    <div className="flex flex-1 min-h-0 titlebar-no-drag">
      <aside className="w-52 shrink-0 border-r border-border-subtle bg-surface/50 flex flex-col">
        <div className="px-4 py-4 border-b border-border-subtle">
          <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
          <p className="text-[11px] text-text-muted mt-0.5">Preferences</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto sidebar-scroll">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors ${
                category === id
                  ? 'bg-surface-muted text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-overlay/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={resetSettings}
            className="flex items-center gap-2 text-[11px] text-text-muted hover:text-text-secondary transition-colors w-full px-2 py-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto sidebar-scroll">
        <div className="max-w-2xl p-8">
          {category === 'appearance' && (
            <Panel title="Appearance" description="Theme, density, and motion preferences.">
              <Row label="Theme">
                <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} className={selectClass()}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </Row>
              <Row label="UI density" hint="Tighter spacing in sidebars and panels.">
                <select
                  value={uiDensity}
                  onChange={(e) => setUiDensity(e.target.value as typeof uiDensity)}
                  className={selectClass()}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </Row>
              <Row label="Reduce motion" hint="Minimizes graph and UI animations.">
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                  className="accent-teal-400"
                />
              </Row>
            </Panel>
          )}

          {category === 'graph' && (
            <Panel title="Graph" description="Default layout and architecture map display.">
              <Row label="Default layout">
                <select
                  value={defaultLayout}
                  onChange={(e) => {
                    const mode = e.target.value as LayoutMode
                    setDefaultLayout(mode)
                    setLayoutMode(mode)
                  }}
                  className={selectClass()}
                >
                  {LAYOUT_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Session layout" hint="Active layout for the current project.">
                <span className="text-xs text-accent capitalize">{layoutMode}</span>
              </Row>
              <Row label="Initial zoom" hint="Camera zoom when a project first loads.">
                <input
                  type="range"
                  min={0.5}
                  max={1.4}
                  step={0.02}
                  value={initialZoom}
                  onChange={(e) => setInitialZoom(Number(e.target.value))}
                  className="w-32 accent-teal-400"
                />
              </Row>
              <Row label="Hierarchy layer labels" hint="Ring labels in hierarchy layout.">
                <input
                  type="checkbox"
                  checked={showHierarchyLabels}
                  onChange={(e) => setShowHierarchyLabels(e.target.checked)}
                  className="accent-teal-400"
                />
              </Row>
              <Row label="Edge import labels" hint="Show import paths on dependency edges.">
                <input
                  type="checkbox"
                  checked={showEdgeLabels}
                  onChange={(e) => setShowEdgeLabels(e.target.checked)}
                  className="accent-teal-400"
                />
              </Row>
            </Panel>
          )}

          {category === 'editor' && (
            <Panel title="Editor" description="Monaco code viewer preferences.">
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
              <Row label="Minimap">
                <input
                  type="checkbox"
                  checked={editorMinimap}
                  onChange={(e) => setEditorMinimap(e.target.checked)}
                  className="accent-teal-400"
                />
              </Row>
            </Panel>
          )}

          {category === 'interaction' && (
            <Panel title="Interaction" description="Pan, zoom, and node drag behavior.">
              <Row label="Pan sensitivity">
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={panSensitivity}
                  onChange={(e) => setPanSensitivity(Number(e.target.value))}
                  className="w-32 accent-teal-400"
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
                  className="w-32 accent-teal-400"
                />
              </Row>
              <Row
                label="Node drag delay"
                hint="Hover duration before a node becomes draggable. Lower values make panning easier."
              >
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={80}
                    max={400}
                    step={10}
                    value={nodeDragDelayMs}
                    onChange={(e) => setNodeDragDelayMs(Number(e.target.value))}
                    className="w-28 accent-teal-400"
                  />
                  <span className="text-[11px] text-text-muted w-10 text-right">{nodeDragDelayMs}ms</span>
                </div>
              </Row>
            </Panel>
          )}

          {category === 'performance' && (
            <Panel title="Performance" description="Rendering quality and motion.">
              <Row label="Graph quality" hint="Performance mode reduces edge animation and motion.">
                <select
                  value={graphQuality}
                  onChange={(e) => setGraphQuality(e.target.value as typeof graphQuality)}
                  className={selectClass()}
                >
                  <option value="balanced">Balanced</option>
                  <option value="performance">Performance</option>
                </select>
              </Row>
              <Row label="Reduce motion" hint="Same as Appearance — disables heavy animations.">
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                  className="accent-teal-400"
                />
              </Row>
            </Panel>
          )}

          {category === 'about' && (
            <div className="space-y-6">
              <Panel title="About PreBase" description="Architecture intelligence for your codebase.">
                <div className="py-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{APP_NAME}</p>
                      <p className="text-xs text-text-muted">Version {APP_VERSION}</p>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Real-time software architecture visualization built with Electron, React, and React Flow.
                  </p>
                  <div className="text-[11px] text-text-muted space-y-1 pt-1">
                    <p>Runtime: Electron + Vite</p>
                    <p>Graph: React Flow · Layout: concentric dependency rings</p>
                    <p>Editor: Monaco</p>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Supported languages"
                description="Graph import analysis and editor syntax highlighting."
              >
                <div className="py-2 max-h-64 overflow-y-auto sidebar-scroll space-y-1">
                  {graphLanguages.map((lang) => (
                    <div
                      key={lang.id}
                      className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-muted/50"
                    >
                      <span className="text-sm text-text-primary">{lang.name}</span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {lang.extensions.join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-text-muted px-2 pb-3">
                  + CSS, HTML, JSON for viewing in the code editor.
                </p>
              </Panel>

              <Panel title="Creators">
                <p className="text-sm text-text-secondary py-3">Built by the PreBase team.</p>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
