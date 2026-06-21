import { motion } from 'framer-motion'
import { Clock, FolderOpen, Sparkles } from 'lucide-react'
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

function shortenPath(path: string, max = 42): string {
  if (path.length <= max) return path
  const head = path.slice(0, 16)
  const tail = path.slice(-(max - 19))
  return `${head}…${tail}`
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
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpen}
      disabled={disabled}
      className={`group relative flex flex-col text-left w-full min-h-[118px] p-4 rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ${
        isMostRecent
          ? 'border-accent/45 bg-surface-overlay/70 shadow-[0_0_0_1px_rgba(45,212,191,0.12)] hover:border-accent/60 hover:bg-surface-overlay/90'
          : 'border-border-subtle bg-surface-overlay/45 hover:border-border-default hover:bg-surface-overlay/70 hover:-translate-y-0.5'
      }`}
    >
      {isMostRecent && (
        <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider font-medium text-accent/90 px-2 py-0.5 rounded-full border border-accent/25 bg-accent/10">
          Last opened
        </span>
      )}

      <div className="flex items-start gap-2.5 pr-16 min-w-0">
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 border ${
            isMostRecent
              ? 'border-accent/30 bg-accent/10'
              : 'border-border-subtle bg-surface-muted/40 group-hover:border-accent/20'
          }`}
        >
          <FolderOpen
            className={`w-4 h-4 ${isMostRecent ? 'text-accent' : 'text-text-muted group-hover:text-accent/80'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">{project.name}</p>
          <p className="text-[10px] text-text-muted font-mono truncate mt-0.5" title={project.path}>
            {shortenPath(project.path)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-3 text-[10px] text-text-muted">
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
  )
}

export function RecentProjectsBlock({ onOpenProjectPath, isLoading }: RecentProjectsBlockProps) {
  const projects = useRecentProjectsStore((s) => s.projects)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mt-10 w-full max-w-2xl"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
