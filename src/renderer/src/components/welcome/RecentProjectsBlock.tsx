import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Clock, FolderOpen, FolderSearch, Sparkles, Trash2 } from 'lucide-react'
import type { RecentProject } from '../../state/recent-projects-store'
import { useRecentProjectsStore } from '../../state/recent-projects-store'

interface RecentProjectsBlockProps {
  onOpenProjectPath: (path: string) => void
  isLoading: boolean
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function revealInFileManagerLabel(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform : ''
  if (/Mac/i.test(platform)) return 'Show in Finder'
  if (/Win/i.test(platform)) return 'Show in File Explorer'
  return 'Show in File Manager'
}

/** Insert zero-width spaces after slashes so paths wrap at separators, not mid-name. */
function PathWithSlashWrap({ path }: { path: string }) {
  const wrapped = path.replace(/\//g, '/\u200B')
  return (
    <p
      className="text-[10px] text-text-muted font-mono leading-relaxed whitespace-normal break-normal"
      title={path}
    >
      {wrapped}
    </p>
  )
}

function RecentProjectContextMenu({
  x,
  y,
  onClose,
  onOpen,
  onReveal,
  onRemove
}: {
  x: number
  y: number
  onClose: () => void
  onOpen: () => void
  onReveal: () => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const items = [
    { icon: FolderOpen, label: 'Open Project', action: onOpen },
    { icon: FolderSearch, label: revealInFileManagerLabel(), action: onReveal },
    { icon: Trash2, label: 'Remove from Recent Projects', action: onRemove, danger: true }
  ]

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      style={{ position: 'fixed', top: y, left: x, zIndex: 10000 }}
      className="min-w-[210px] py-1 rounded-xl border border-border-subtle bg-surface-overlay shadow-panel titlebar-no-drag"
    >
      {items.map(({ icon: Icon, label, action, danger }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            action()
            onClose()
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
            danger
              ? 'text-red-300/90 hover:text-red-200 hover:bg-red-500/10'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted/80'
          }`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0 text-text-muted" />
          {label}
        </button>
      ))}
    </motion.div>,
    document.body
  )
}

function RecentProjectCard({
  project,
  isMostRecent,
  index,
  onOpen,
  disabled
}: {
  project: RecentProject
  isMostRecent: boolean
  index: number
  onOpen: () => void
  disabled: boolean
}) {
  const removeProject = useRecentProjectsStore((s) => s.removeProject)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [revealError, setRevealError] = useState<string | null>(null)

  const handleReveal = useCallback(async () => {
    setRevealError(null)
    const result = await window.prebase.showItemInFolder(project.path)
    if (!result.success) {
      setRevealError(result.error ?? 'Could not reveal project folder')
    }
  }, [project.path])

  const handleRemove = useCallback(() => {
    removeProject(project.path)
  }, [project.path, removeProject])

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={onOpen}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
          setRevealError(null)
        }}
        disabled={disabled}
        className={`group relative flex flex-col text-left w-full min-w-0 h-auto p-4 rounded-xl border transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${
          isMostRecent
            ? 'border-accent/45 bg-surface-overlay/70 shadow-[0_0_0_1px_rgba(45,212,191,0.12)] hover:border-accent/55 hover:bg-surface-overlay/90 hover:shadow-[0_0_28px_rgba(45,212,191,0.18),0_0_0_1px_rgba(45,212,191,0.2)]'
            : 'border-border-subtle bg-surface-overlay/45 hover:border-accent/30 hover:bg-surface-overlay/70 hover:shadow-[0_0_24px_rgba(56,189,248,0.12),0_0_0_1px_rgba(45,212,191,0.12)] hover:-translate-y-0.5'
        }`}
      >
        {isMostRecent && (
          <span className="absolute top-3 right-3 z-10 inline-flex text-[9px] uppercase tracking-wider font-medium text-accent/90 px-2 py-0.5 rounded-full border border-accent/25 bg-accent/10">
            Last opened
          </span>
        )}

        <div className="flex flex-col w-full min-w-0">
          <div className="flex items-start gap-3 w-full min-w-0">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 border transition-colors duration-300 ${
                isMostRecent
                  ? 'border-accent/30 bg-accent/10 group-hover:border-accent/45 group-hover:bg-accent/15'
                  : 'border-border-subtle bg-surface-muted/40 group-hover:border-accent/25 group-hover:bg-accent/5'
              }`}
            >
              <FolderOpen
                className={`w-4 h-4 transition-colors duration-300 ${isMostRecent ? 'text-accent' : 'text-text-muted group-hover:text-accent/80'}`}
              />
            </div>

            <div className={`min-w-0 flex-1 ${isMostRecent ? 'pr-[5.75rem]' : ''}`}>
              <p
                className="text-sm font-medium text-text-primary truncate w-full min-w-0"
                title={project.name}
              >
                {project.name}
              </p>
            </div>
          </div>

          <div className="w-full min-w-0 mt-1.5">
            <PathWithSlashWrap path={project.path} />
            {revealError && (
              <p className="text-[10px] text-red-300/80 leading-snug mt-1">{revealError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border-subtle/60 text-[10px] text-text-muted flex-wrap">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{formatRelativeTime(project.lastOpenedAt)}</span>
          {project.fileCount !== undefined && (
            <>
              <span className="w-px h-2.5 bg-border-subtle" />
              <span>{project.fileCount} files</span>
            </>
          )}
          {project.dominantLanguage && (
            <>
              <span className="w-px h-2.5 bg-border-subtle" />
              <span>{project.dominantLanguage}</span>
            </>
          )}
        </div>
      </motion.button>

      {menu && (
        <RecentProjectContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpen={onOpen}
          onReveal={() => void handleReveal()}
          onRemove={handleRemove}
        />
      )}
    </>
  )
}

export function RecentProjectsBlock({ onOpenProjectPath, isLoading }: RecentProjectsBlockProps) {
  const projects = useRecentProjectsStore((s) => s.projects)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mt-10 w-full max-w-4xl"
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <Sparkles className="w-3.5 h-3.5 text-accent/80" />
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-medium">
          Recent projects
        </h2>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface-overlay/30 px-5 py-6 text-center">
          <p className="text-xs text-text-secondary">No recent projects yet.</p>
          <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
            Open a project to begin mapping your codebase.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {projects.map((project, index) => (
            <RecentProjectCard
              key={project.id}
              project={project}
              isMostRecent={index === 0}
              index={index}
              disabled={isLoading}
              onOpen={() => onOpenProjectPath(project.path)}
            />
          ))}
        </div>
      )}
    </motion.section>
  )
}
