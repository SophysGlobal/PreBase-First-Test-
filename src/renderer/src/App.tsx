import { useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ActivityBar } from './components/layout/ActivityBar'
import { SecondarySidebar } from './components/layout/SecondarySidebar'
import { GraphCanvas } from './components/graph/GraphCanvas'
import { WelcomeScreen } from './components/welcome/WelcomeScreen'
import { GraphToolbar } from './components/toolbar/GraphToolbar'
import { useGraphStore } from './state/graph-store'
import { findNodeByQuery } from './utils/flow-adapter'

export default function App() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const isLoading = useGraphStore((s) => s.isLoading)
  const error = useGraphStore((s) => s.error)
  const viewMode = useGraphStore((s) => s.viewMode)
  const setLoading = useGraphStore((s) => s.setLoading)
  const setError = useGraphStore((s) => s.setError)
  const setSnapshot = useGraphStore((s) => s.setSnapshot)
  const applyIncremental = useGraphStore((s) => s.applyIncremental)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const reset = useGraphStore((s) => s.reset)

  const handleOpenProject = useCallback(async () => {
    try {
      const path = await window.prebase.openProjectDialog()
      if (!path) return

      setLoading(true)
      setError(null)
      const result = await window.prebase.openProject(path)

      if (!result.success || !result.snapshot) {
        setError(result.error ?? 'Failed to open project')
        setLoading(false)
        return
      }

      setSnapshot(result.snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [setLoading, setError, setSnapshot])

  const handleRelayout = useCallback(async () => {
    const updated = await window.prebase.relayout(layoutMode)
    if (updated) setSnapshot(updated)
  }, [layoutMode, setSnapshot])

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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleOpenProject, setFocusedNodeId, setSelectedNodeId, setSelectedEdgeId])

  return (
    <motion.div className="flex h-screen w-screen bg-surface overflow-hidden">
      <div className="macos-traffic-safe-zone" aria-hidden="true" />
      {snapshot && <ActivityBar />}

      {snapshot && (
        <SecondarySidebar
          onOpenProject={handleOpenProject}
          onRelayout={async (mode) => {
            const updated = await window.prebase.relayout(mode)
            if (updated) setSnapshot(updated)
          }}
        />
      )}

      <main className="flex flex-col flex-1 min-w-0 relative">
        <AnimatePresence mode="wait">
          {!snapshot ? (
            <WelcomeScreen key="welcome" onOpenProject={handleOpenProject} isLoading={isLoading} />
          ) : viewMode === 'graph' ? (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 relative"
            >
              <ReactFlowProvider>
                <GraphCanvas />
                <GraphToolbar onRelayout={handleRelayout} />
              </ReactFlowProvider>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center bg-surface-raised/30"
            >
              <div className="text-center max-w-md px-8">
                <p className="text-sm text-text-secondary mb-2">Code view</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Use the file explorer to browse your project structure. Switch to Graph view
                  to explore architecture and dependencies visually.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm z-50"
          >
            {error}
          </motion.div>
        )}

        {isLoading && snapshot && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-overlay border border-border-subtle">
              <motion.div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">Updating architecture...</span>
            </div>
          </div>
        )}
      </main>
    </motion.div>
  )
}
