import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Code2,
  FileCode,
  Folder,
  Layers,
  PanelRightOpen,
  Star,
  X
} from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { getNodeInspectorData, type NodeConnection } from '../../utils/graph-metadata'
import { inferFileDescription } from '../../utils/file-description'
import {
  folderPathFromId,
  getFolderInspectorContents
} from '../../utils/folder-expansion'

export function NodeInspector() {
  const inspectorWidth = useSettingsStore((s) => s.inspectorPanelWidth)
  const snapshot = useGraphStore((s) => s.snapshot)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setInspectorOpen = useGraphStore((s) => s.setInspectorOpen)
  const openFileInCodeView = useGraphStore((s) => s.openFileInCodeView)

  if (!snapshot || !selectedNodeId || !inspectorOpen) return null

  const node = snapshot.nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const isFolder = node.kind === 'folder'
  const isEntry = node.isEntry || node.id === snapshot.entryNodeId

  if (isFolder) {
    const { files, subfolders, fileCount, folderCount } = getFolderInspectorContents(
      snapshot,
      node.id
    )
    const folderPath = folderPathFromId(node.id)

    return (
      <AnimatePresence>
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="absolute top-0 right-0 h-full border-l border-border-subtle bg-surface-raised z-40 isolate flex flex-col shadow-panel titlebar-no-drag"
          style={{ width: inspectorWidth }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Folder className="w-4 h-4 text-text-muted shrink-0" />
              <span className="text-sm font-medium truncate">{node.label}</span>
            </div>
            <button
              onClick={() => {
                setSelectedNodeId(null)
                setInspectorOpen(false)
              }}
              className="p-1 rounded hover:bg-surface-muted text-text-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="p-3 space-y-3 shrink-0 border-b border-border-subtle text-xs">
              <section>
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Path</p>
                <p className="text-text-secondary font-mono text-[11px] break-all">{folderPath}</p>
              </section>
              <div className="grid grid-cols-2 gap-1.5">
                <MiniStat label="Files" value={fileCount} />
                <MiniStat label="Folders" value={folderCount} />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll p-2 space-y-2">
              {subfolders.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 px-1">
                    Subfolders
                  </p>
                  <ul className="space-y-0.5">
                    {subfolders.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-text-secondary"
                      >
                        <Folder className="w-3 h-3 shrink-0 text-text-muted" />
                        <span className="truncate">{f.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 px-1">
                  Files ({files.length})
                </p>
                <ul className="space-y-0.5">
                  {files.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => openFileInCodeView(f.id)}
                        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] text-text-secondary hover:bg-surface-muted transition-colors"
                      >
                        <FileCode className="w-3 h-3 shrink-0 text-accent" />
                        <span className="truncate">{f.label}</span>
                      </button>
                    </li>
                  ))}
                  {files.length === 0 && (
                    <p className="text-[11px] text-text-muted px-2 py-1">No direct files</p>
                  )}
                </ul>
              </section>
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>
    )
  }

  const data = getNodeInspectorData(snapshot, selectedNodeId)
  if (!data) return null

  const { incomingConnections, outgoingConnections } = data
  const description = inferFileDescription(node)

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="absolute top-0 right-0 h-full border-l border-border-subtle bg-surface-raised z-40 isolate flex flex-col shadow-panel titlebar-no-drag"
        style={{ width: inspectorWidth }}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {node.kind === 'component' ? (
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            ) : (
              <FileCode className="w-4 h-4 text-accent shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{node.label}</span>
            {isEntry && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </div>
          <button
            onClick={() => {
              setSelectedNodeId(null)
              setInspectorOpen(false)
            }}
            className="p-1 rounded hover:bg-surface-muted text-text-muted"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 border-b border-border-subtle shrink-0">
          <button
            type="button"
            onClick={() => openFileInCodeView(node.id)}
            disabled={!node.path}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white text-surface text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            Open in Code View
          </button>
          <p className="text-[9px] text-text-muted text-center mt-1.5 flex items-center justify-center gap-1">
            <PanelRightOpen className="w-3 h-3" />
            Right-click for quick actions
          </p>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll p-3 space-y-3 text-xs">
          <section className="rounded-lg bg-surface-overlay/60 border border-border-subtle px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">About</p>
            <p className="text-text-secondary leading-relaxed text-[11px]">{description}</p>
          </section>

          {node.path && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Path</p>
              <p className="text-text-secondary font-mono text-[11px] break-all">{node.path}</p>
            </section>
          )}

          {node.meta?.architectureLayer && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Layer</p>
              <span className="inline-flex px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-[10px] capitalize">
                {node.meta.architectureLayer}
              </span>
            </section>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <MiniStat label="Imports" value={outgoingConnections.length} />
            <MiniStat label="Used by" value={incomingConnections.length} />
          </div>

          {outgoingConnections.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Connected files
              </p>
              <ul className="space-y-1 max-h-[140px] overflow-y-auto sidebar-scroll">
                {outgoingConnections.slice(0, 24).map((c) => (
                  <ConnectionRow key={c.nodeId} connection={c} />
                ))}
              </ul>
            </section>
          )}

          {incomingConnections.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3" /> Referenced by
              </p>
              <ul className="space-y-1 max-h-[140px] overflow-y-auto sidebar-scroll">
                {incomingConnections.slice(0, 24).map((c) => (
                  <ConnectionRow key={c.nodeId} connection={c} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

function ConnectionRow({ connection }: { connection: NodeConnection }) {
  const selectNodeInGraph = useGraphStore((s) => s.selectNodeInGraph)
  return (
    <li>
      <button
        type="button"
        onClick={() => selectNodeInGraph(connection.nodeId)}
        className="w-full text-left px-2 py-1.5 rounded-md border border-border-subtle/60 bg-surface-overlay/40 hover:bg-surface-muted transition-colors"
      >
        <p className="text-[11px] text-text-primary truncate font-medium">{connection.label}</p>
        <p className="text-[9px] text-accent/90 mt-0.5">{connection.relationship}</p>
        {connection.importSource && (
          <p className="text-[9px] text-text-muted truncate mt-0.5 font-mono">
            {connection.importSource}
          </p>
        )}
      </button>
    </li>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-1.5 rounded-lg bg-surface-overlay border border-border-subtle">
      <p className="text-[9px] text-text-muted">{label}</p>
      <p className="text-base font-semibold text-text-primary tabular-nums">{value}</p>
    </div>
  )
}
