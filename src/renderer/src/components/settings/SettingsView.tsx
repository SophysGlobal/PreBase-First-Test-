import { useCallback, useState, type ReactNode } from 'react'
import {
  Info,
  Layers,
  Monitor,
  MousePointer2,
  PanelLeft,
  Pencil,
  RotateCcw,
  Sparkles,
  Workflow
} from 'lucide-react'
import { SidebarCustomizationPanel } from './SidebarCustomizationPanel'
import type { LayoutMode } from '../../../../core/types'
import { APP_NAME, APP_VERSION, SUPPORTED_LANGUAGES } from '../../../../core/constants/supported-languages'
import { LAYOUT_PRESETS } from '../../constants/graph-help'
import { useSettingsStore } from '../../state/settings-store'
import { useGraphStore } from '../../state/graph-store'
import { layoutRuntimeFromSettings } from '../../utils/layout-settings'

type SettingsCategory =
  | 'appearance'
  | 'graph'
  | 'sidebar'
  | 'editor'
  | 'interaction'
  | 'performance'
  | 'about'

const CATEGORIES: {
  id: SettingsCategory
  label: string
  icon: typeof Monitor
}[] = [
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'graph', label: 'Graph', icon: Workflow },
  { id: 'sidebar', label: 'Sidebar', icon: PanelLeft },
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

function AdvancedPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/30 px-4 h-fit sticky top-8">
      {children}
    </div>
  )
}

function selectClass() {
  return 'text-xs rounded-lg bg-surface-muted border border-border-subtle px-2.5 py-1.5 text-text-primary min-w-[120px]'
}

export function SettingsView() {
  const [category, setCategory] = useState<SettingsCategory>('appearance')
  const snapshot = useGraphStore((s) => s.snapshot)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)
  const setSnapshot = useGraphStore((s) => s.setSnapshot)

  const settings = useSettingsStore()

  const applyGraphRelayout = useCallback(async () => {
    if (!snapshot) return
    const s = useSettingsStore.getState()
    const updated = await window.prebase.relayout(layoutMode, layoutRuntimeFromSettings(s))
    if (updated) setSnapshot(updated)
  }, [snapshot, layoutMode, setSnapshot])

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
            onClick={settings.resetSettings}
            className="flex items-center gap-2 text-[11px] text-text-muted hover:text-text-secondary transition-colors w-full px-2 py-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto sidebar-scroll">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-8 p-8 max-w-6xl">
          <div className="min-w-0 space-y-6">
            {category === 'appearance' && (
              <Panel title="Appearance" description="Theme, density, and motion preferences.">
                <Row label="Theme">
                  <select
                    value={settings.theme}
                    onChange={(e) => settings.setTheme(e.target.value as typeof settings.theme)}
                    className={selectClass()}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </Row>
                <Row label="UI density" hint="Tighter spacing in sidebars and panels.">
                  <select
                    value={settings.uiDensity}
                    onChange={(e) => settings.setUiDensity(e.target.value as typeof settings.uiDensity)}
                    className={selectClass()}
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </Row>
                <Row label="Reduce motion" hint="Minimizes graph and UI animations.">
                  <input
                    type="checkbox"
                    checked={settings.reduceMotion}
                    onChange={(e) => settings.setReduceMotion(e.target.checked)}
                    className="accent-teal-400"
                  />
                </Row>
              </Panel>
            )}

            {category === 'graph' && (
              <Panel title="Graph" description="Default layout and architecture map display.">
                <Row label="Default layout">
                  <select
                    value={settings.defaultLayout}
                    onChange={(e) => {
                      const mode = e.target.value as LayoutMode
                      settings.setDefaultLayout(mode)
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
                    value={settings.initialZoom}
                    onChange={(e) => settings.setInitialZoom(Number(e.target.value))}
                    className="w-32 accent-teal-400"
                  />
                </Row>
                <Row label="Edge import labels" hint="Show import paths on dependency edges.">
                  <input
                    type="checkbox"
                    checked={settings.showEdgeLabels}
                    onChange={(e) => settings.setShowEdgeLabels(e.target.checked)}
                    className="accent-teal-400"
                  />
                </Row>
              </Panel>
            )}

            {category === 'sidebar' && <SidebarCustomizationPanel />}

            {category === 'editor' && (
              <Panel title="Editor" description="Monaco code viewer preferences.">
                <Row label="Font size">
                  <input
                    type="number"
                    min={11}
                    max={20}
                    value={settings.editorFontSize}
                    onChange={(e) => settings.setEditorFontSize(Number(e.target.value) || 13)}
                    className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1 text-text-primary"
                  />
                </Row>
                <Row label="Line numbers">
                  <input
                    type="checkbox"
                    checked={settings.editorLineNumbers}
                    onChange={(e) => settings.setEditorLineNumbers(e.target.checked)}
                    className="accent-teal-400"
                  />
                </Row>
                <Row label="Word wrap">
                  <input
                    type="checkbox"
                    checked={settings.editorWordWrap}
                    onChange={(e) => settings.setEditorWordWrap(e.target.checked)}
                    className="accent-teal-400"
                  />
                </Row>
                <Row label="Minimap">
                  <input
                    type="checkbox"
                    checked={settings.editorMinimap}
                    onChange={(e) => settings.setEditorMinimap(e.target.checked)}
                    className="accent-teal-400"
                  />
                </Row>
              </Panel>
            )}

            {category === 'interaction' && (
              <Panel title="Interaction" description="Pan and zoom behavior.">
                <Row label="Pan sensitivity">
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.panSensitivity}
                    onChange={(e) => settings.setPanSensitivity(Number(e.target.value))}
                    className="w-32 accent-teal-400"
                  />
                </Row>
                <Row label="Zoom sensitivity">
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.zoomSensitivity}
                    onChange={(e) => settings.setZoomSensitivity(Number(e.target.value))}
                    className="w-32 accent-teal-400"
                  />
                </Row>
                <Row
                  label="Network drag direction"
                  hint="Natural follows cursor drag like grabbing the sphere; Inverted rotates opposite to cursor."
                >
                  <select
                    value={settings.networkDragDirection}
                    onChange={(e) =>
                      settings.setNetworkDragDirection(e.target.value as 'natural' | 'inverted')
                    }
                    className={selectClass()}
                  >
                    <option value="natural">Natural</option>
                    <option value="inverted">Inverted</option>
                  </select>
                </Row>
              </Panel>
            )}

            {category === 'performance' && (
              <Panel title="Performance" description="Rendering quality and graph limits.">
                <Row label="Graph quality" hint="Performance mode reduces edge animation.">
                  <select
                    value={settings.graphQuality}
                    onChange={(e) => settings.setGraphQuality(e.target.value as typeof settings.graphQuality)}
                    className={selectClass()}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="performance">Performance</option>
                  </select>
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
                      Real-time software architecture visualization built with Electron, React, and
                      React Flow.
                    </p>
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
                </Panel>
              </div>
            )}
          </div>

          {(category === 'graph' ||
            category === 'editor' ||
            category === 'interaction' ||
            category === 'performance') && (
            <aside className="min-w-0 hidden xl:block">
              <AdvancedPanel>
                <div className="py-3 border-b border-border-subtle/60 mb-1">
                  <h3 className="text-sm font-semibold text-text-primary">Advanced</h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {category === 'graph' && snapshot
                      ? 'Layout changes apply after relayout.'
                      : 'Fine-tuned controls for this category.'}
                  </p>
                </div>

                {category === 'graph' && (
                  <>
                    <Row label="Layout animation" hint="Fit-view duration in milliseconds.">
                      <input
                        type="number"
                        min={0}
                        max={2000}
                        step={50}
                        value={settings.layoutAnimationDuration}
                        onChange={(e) =>
                          settings.setLayoutAnimationDuration(Number(e.target.value) || 0)
                        }
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Layer radius scale" hint="Scales concentric ring radii.">
                      <input
                        type="range"
                        min={0.7}
                        max={1.4}
                        step={0.05}
                        value={settings.layerRadiusScale}
                        onChange={(e) => {
                          settings.setLayerRadiusScale(Number(e.target.value))
                          void applyGraphRelayout()
                        }}
                        className="w-28 accent-teal-400"
                      />
                    </Row>
                    <Row label="Max nodes per layer" hint="Before an overflow sub-ring is added.">
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={settings.maxNodesPerLayer}
                        onChange={(e) => {
                          settings.setMaxNodesPerLayer(Number(e.target.value) || 24)
                          void applyGraphRelayout()
                        }}
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Layer gap" hint="Distance between dependency rings.">
                      <input
                        type="number"
                        min={80}
                        max={200}
                        step={4}
                        value={settings.layerGap}
                        onChange={(e) => {
                          settings.setLayerGap(Number(e.target.value) || 132)
                          void applyGraphRelayout()
                        }}
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Center clearance" hint="Radius of the innermost ring.">
                      <input
                        type="number"
                        min={64}
                        max={160}
                        step={4}
                        value={settings.centerClearance}
                        onChange={(e) => {
                          settings.setCenterClearance(Number(e.target.value) || 108)
                          void applyGraphRelayout()
                        }}
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Scatter balance passes" hint="Spacing relaxation iterations.">
                      <input
                        type="number"
                        min={4}
                        max={24}
                        value={settings.scatterRelaxIterations}
                        onChange={(e) => {
                          settings.setScatterRelaxIterations(Number(e.target.value) || 10)
                          void applyGraphRelayout()
                        }}
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Folder expansion radius" hint="Tree mode radial child layout.">
                      <input
                        type="range"
                        min={48}
                        max={160}
                        step={4}
                        value={settings.folderExpansionRadius}
                        onChange={(e) => settings.setFolderExpansionRadius(Number(e.target.value))}
                        className="w-28 accent-teal-400"
                      />
                    </Row>
                    <Row
                      label="Visible related connections"
                      hint="Root link always shown; controls extra ranked links per file (0–3)."
                    >
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={1}
                        value={settings.visibleRelatedConnections}
                        onChange={(e) =>
                          settings.setVisibleRelatedConnections(
                            Number(e.target.value) as 0 | 1 | 2
                          )
                        }
                        className="w-28 accent-teal-400"
                      />
                      <span className="text-[10px] text-text-muted tabular-nums w-4">
                        {settings.visibleRelatedConnections}
                      </span>
                    </Row>
                    <div className="py-2 border-b border-border-subtle/60">
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        Network graph
                      </p>
                    </div>
                    <Row
                      label="Physics strength"
                      hint="Scales repulsion and centering forces in the network view."
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.05}
                          value={settings.networkPhysicsStrength}
                          onChange={(e) =>
                            settings.setNetworkPhysicsStrength(Number(e.target.value))
                          }
                          className="w-28 accent-teal-400"
                        />
                        <span className="text-[10px] text-text-muted tabular-nums w-8 text-right">
                          {settings.networkPhysicsStrength.toFixed(2)}×
                        </span>
                      </div>
                    </Row>
                    <Row
                      label="Edge opacity"
                      hint="Network link visibility. Higher is more readable."
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0.2}
                          max={0.9}
                          step={0.05}
                          value={settings.networkEdgeOpacity}
                          onChange={(e) =>
                            settings.setNetworkEdgeOpacity(Number(e.target.value))
                          }
                          className="w-28 accent-teal-400"
                        />
                        <span className="text-[10px] text-text-muted tabular-nums w-8 text-right">
                          {settings.networkEdgeOpacity.toFixed(2)}
                        </span>
                      </div>
                    </Row>
                    {snapshot && (
                      <div className="py-3">
                        <button
                          type="button"
                          onClick={() => void applyGraphRelayout()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/25 hover:bg-teal-500/25 transition-colors"
                        >
                          Apply layout now
                        </button>
                      </div>
                    )}
                  </>
                )}

                {category === 'editor' && (
                  <>
                    <Row label="Bracket colorization">
                      <input
                        type="checkbox"
                        checked={settings.editorBracketPairColorization}
                        onChange={(e) =>
                          settings.setEditorBracketPairColorization(e.target.checked)
                        }
                        className="accent-teal-400"
                      />
                    </Row>
                    <Row label="Render whitespace">
                      <select
                        value={settings.editorRenderWhitespace}
                        onChange={(e) =>
                          settings.setEditorRenderWhitespace(
                            e.target.value as typeof settings.editorRenderWhitespace
                          )
                        }
                        className={selectClass()}
                      >
                        <option value="none">None</option>
                        <option value="boundary">Boundary</option>
                        <option value="selection">Selection</option>
                        <option value="all">All</option>
                      </select>
                    </Row>
                    <Row label="Scroll beyond last line">
                      <input
                        type="checkbox"
                        checked={settings.editorScrollBeyondLastLine}
                        onChange={(e) => settings.setEditorScrollBeyondLastLine(e.target.checked)}
                        className="accent-teal-400"
                      />
                    </Row>
                    <Row label="Smooth caret">
                      <input
                        type="checkbox"
                        checked={settings.editorCursorSmoothCaret}
                        onChange={(e) => settings.setEditorCursorSmoothCaret(e.target.checked)}
                        className="accent-teal-400"
                      />
                    </Row>
                  </>
                )}

                {category === 'interaction' && (
                  <>
                    <Row
                      label="Intent hover delay"
                      hint="Deliberate hover (ms) before a node enters focus and becomes draggable. Drives the intentionality system in both graphs."
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={80}
                          max={400}
                          step={10}
                          value={settings.nodeDragDelayMs}
                          onChange={(e) =>
                            settings.setNodeDragDelayMs(Number(e.target.value) || 200)
                          }
                          className="w-24 accent-teal-400"
                        />
                        <span className="text-[10px] text-text-muted tabular-nums w-10 text-right">
                          {settings.nodeDragDelayMs}ms
                        </span>
                      </div>
                    </Row>
                  </>
                )}

                {category === 'performance' && (
                  <>
                    <Row label="Max rendered nodes" hint="Caps visible nodes by importance.">
                      <input
                        type="number"
                        min={50}
                        max={2000}
                        step={50}
                        value={settings.maxRenderedNodes}
                        onChange={(e) => settings.setMaxRenderedNodes(Number(e.target.value) || 400)}
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Render throttle" hint="Delays graph node/edge sync (ms).">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={settings.renderThrottlingMs}
                        onChange={(e) => settings.setRenderThrottlingMs(Number(e.target.value))}
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Network LOD threshold" hint="Above this node count, network view uses performance mode.">
                      <input
                        type="number"
                        min={400}
                        max={3000}
                        step={100}
                        value={settings.networkLodNodeThreshold}
                        onChange={(e) =>
                          settings.setNetworkLodNodeThreshold(Number(e.target.value) || 900)
                        }
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                    <Row label="Network simulation ticks" hint="Force layout warmup/cooldown scale.">
                      <input
                        type="number"
                        min={20}
                        max={200}
                        value={settings.networkSimulationTicks}
                        onChange={(e) =>
                          settings.setNetworkSimulationTicks(Number(e.target.value) || 80)
                        }
                        className="w-16 text-xs rounded-lg bg-surface-muted border border-border-subtle px-2 py-1"
                      />
                    </Row>
                  </>
                )}
              </AdvancedPanel>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
