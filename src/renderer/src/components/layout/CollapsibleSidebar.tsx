import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSettingsStore } from '../../state/settings-store'

interface CollapsibleSidebarProps {
  collapsed: boolean
  onToggle: () => void
  title: string
  railIcon?: ReactNode
  children: ReactNode
  /** When true, the content area does not scroll itself — children manage their own scroll panes. */
  fill?: boolean
}

export function CollapsibleSidebar({
  collapsed,
  onToggle,
  title,
  railIcon,
  children,
  fill = false
}: CollapsibleSidebarProps) {
  const rawWidth = useSettingsStore((s) => s.secondarySidebarWidth)
  const minWidth = useSettingsStore((s) => s.sidebarMinWidth)
  const maxWidth = useSettingsStore((s) => s.sidebarMaxWidth)
  const collapsedRail = useSettingsStore((s) => s.secondarySidebarCollapsedWidth)
  const expandedWidth = Math.min(maxWidth, Math.max(minWidth, rawWidth))

  return (
    <motion.aside
      animate={{ width: collapsed ? collapsedRail : expandedWidth }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="relative flex flex-col h-full border-r border-border-subtle bg-surface-raised/95 shrink-0 overflow-hidden"
    >
      {collapsed ? (
        <div className="flex flex-col items-center h-full w-full py-3 gap-3 titlebar-no-drag">
          <button
            type="button"
            onClick={onToggle}
            title="Expand sidebar"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-accent hover:bg-accent-soft/50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {railIcon && (
            <div className="flex items-center justify-center w-8 h-8 rounded-lg text-accent/80">
              {railIcon}
            </div>
          )}
          <div className="flex-1 w-px bg-border-subtle/80 mx-auto" />
          <span
            className="text-[9px] uppercase tracking-widest text-text-muted/60 [writing-mode:vertical-rl] rotate-180 select-none"
            title={title}
          >
            {title}
          </span>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0" style={{ width: expandedWidth }}>
          <div className="flex items-center justify-between h-10 px-3 border-b border-border-subtle shrink-0 titlebar-no-drag">
            <span className="text-xs font-medium text-text-secondary truncate">{title}</span>
            <button
              type="button"
              onClick={onToggle}
              title="Collapse sidebar"
              className="p-1 rounded hover:bg-surface-muted text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className={
              fill
                ? 'flex-1 min-h-0 overflow-hidden'
                : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden sidebar-scroll'
            }
          >
            {children}
          </div>
        </div>
      )}
    </motion.aside>
  )
}
