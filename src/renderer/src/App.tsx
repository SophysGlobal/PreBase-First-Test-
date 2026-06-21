import { lazy, Suspense, useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { ActivityBar } from './components/layout/ActivityBar'
import { SecondarySidebar } from './components/layout/SecondarySidebar'
import { GraphCanvas } from './components/graph/GraphCanvas'
const NetworkGraphView = lazy(() =>
  import('./components/graph/NetworkGraphView').then((m) => ({ default: m.NetworkGraphView }))
)
import { WelcomeScreen } from './components/welcome/WelcomeScreen'
import { GraphToolbar } from './components/toolbar/GraphToolbar'
import { CodeEditorView } from './components/code/CodeEditorView'
import { SettingsView } from './components/settings/SettingsView'
import { useGraphStore } from './state/graph-store'
import { useSettingsStore } from './state/settings-store'
import { findNodeByQuery } from './utils/flow-adapter'
import { computeLanguageStats } from './utils/language-stats'
import { useRecentProjectsStore } from './state/recent-projects-store'
import type { LayoutMode } from '../../core/types'
import { computeClientLayout } from './utils/arch-layout-client'
import { layoutRuntimeFromSettings } from './utils/layout-settings'

export default function App() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const isLoading = useGraphStore((s) => s.isLoading)
  const error = useGraphStore((s) => s.error)
  const viewMode = useGraphStore((s) => s.viewMode)
  const graphViewMode = useGraphStore((s) => s.graphViewMode)
  const setLoading = useGraphStore((s) => s.setLoading)
  const setError = useGraphStore((s) => s.setError)
  const setSnapshot = useGraphStore((s) => s.setSnapshot)
  const applyIncremental = useGraphStore((s) => s.applyIncremental)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)
  const reset = useGraphStore((s) => s.reset)

  useEffect(() => {
    const settings = useSettingsStore.getState()
    setLayoutMode(settings.defaultLayout)
  }, [setLayoutMode])

  const handleOpenProjectAtPath = useCallback(
    async (projectPath: string) => {
      try {
        setLoading(true)
        setError(null)
        const result = await window.prebase.openProject(projectPath)

        if (!result.success || !result.snapshot) {
          setError(result.error ?? 'Failed to open project')
          setLoading(false)
          return
        }

        setSnapshot(result.snapshot)
        const settings = useSettingsStore.getState()
        setLayoutMode(settings.defaultLayout)
        const relaid = await window.prebase.relayout(
          settings.defaultLayout,
          layoutRuntimeFromSettings(settings)
        )
        if (relaid) setSnapshot(relaid)

        const stats = computeLanguageStats(result.snapshot.nodes)
        const fileCount = result.snapshot.nodes.filter(
          (n) => n.kind !== 'folder' && n.path
        ).length
        useRecentProjectsStore.getState().recordProjectOpen({
          path: projectPath,
          fileCount,
          dominantLanguage: stats[0]?.name
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    },
    [setLoading, setError, setSnapshot, setLayoutMode]
  )

  const handleOpenProject = useCallback(async () => {
    try {
      const path = await window.prebase.openProjectDialog()
      if (!path) return
      await handleOpenProjectAtPath(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [handleOpenProjectAtPath, setError, setLoading])

  const handleRelayout = useCallback(
    async (mode?: LayoutMode, resetCamera = false) => {
      const snapshot = useGraphStore.getState().snapshot
      if (!snapshot) return
      const settings = useSettingsStore.getState()
      const layoutModeToUse = mode ?? layoutMode
      const runtime = layoutRuntimeFromSettings(settings)
      const positions = computeClientLayout(snapshot, layoutModeToUse, runtime)
      useGraphStore.getState().applyLayoutPositions(positions, { resetCamera })
      void window.prebase.relayout(layoutModeToUse, runtime, { broadcast: false })
    },
    [layoutMode]
  )

  useEffect(() => {
    const unsubFull = window.prebase.onGraphFull((s) => setSnapshot(s))
    const unsubInc = window.prebase.onGraphIncremental((u) => applyIncremental(u))
    return () => {
      unsubFull()
      unsubInc()
      reset()
      void window.prebase.closeProject()
    }
  }, [setSnapshot, applyIncremental, reset])

  useEffect(() => {
    if (!snapshot || !searchQuery.trim()) return
    const node = findNodeByQuery(snapshot.nodes, searchQuery)
    if (node) {
      setFocusedNodeId(node.id)
      setSelectedNodeId(node.id)
    }
  }, [searchQuery, snapshot, setFocusedNodeId, setSelectedNodeId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        void handleOpenProject()
      }
      if (e.key === 'Escape') {
        setFocusedNodeId(null)
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
        useGraphStore.getState().setSelectedRingKey(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleOpenProject, setFocusedNodeId, setSelectedNodeId, setSelectedEdgeId])

  return (
    <AppShell>
      {snapshot && <ActivityBar />}

      {snapshot && viewMode !== 'settings' && (
        <SecondarySidebar
          onOpenProject={handleOpenProject}
          onRelayout={async (mode: LayoutMode) => {
            setLayoutMode(mode)
            await handleRelayout(mode, true)
          }}
        />
      )}

      <main className="flex flex-col flex-1 min-w-0 relative">
        <AnimatePresence mode="wait">
          {!snapshot ? (
            <WelcomeScreen
              key="welcome"
              onOpenProject={handleOpenProject}
              onOpenProjectPath={handleOpenProjectAtPath}
              isLoading={isLoading}
            />
          ) : viewMode === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 min-h-0 bg-surface"
            >
              <SettingsView />
            </motion.div>
          ) : viewMode === 'graph' ? (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 relative min-h-0"
            >
              {graphViewMode === 'network' ? (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                      Loading network view…
                    </div>
                  }
                >
                  <NetworkGraphView />
                </Suspense>
              ) : (
                <ReactFlowProvider>
                  <GraphCanvas />
                  <GraphToolbar onRelayout={() => void handleRelayout(undefined, false)} />
                </ReactFlowProvider>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 min-h-0"
            >
              <CodeEditorView />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm z-50 titlebar-no-drag"
          >
            {error}
          </motion.div>
        )}

        {isLoading && snapshot && (
          <div className="absolute inset-0 bg-surface/85 flex items-center justify-center z-40">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-overlay border border-border-subtle">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">Updating architecture...</span>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}
