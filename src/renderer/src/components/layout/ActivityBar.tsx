import { Code2, Network, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { useGraphStore, type ViewMode } from '../../state/graph-store'

const items: { id: ViewMode; icon: typeof Code2; label: string }[] = [
  { id: 'code', icon: Code2, label: 'Code' },
  { id: 'graph', icon: Network, label: 'Graph' },
  { id: 'settings', icon: Settings, label: 'Settings' }
]

export function ActivityBar() {
  const viewMode = useGraphStore((s) => s.viewMode)
  const setViewMode = useGraphStore((s) => s.setViewMode)
  const snapshot = useGraphStore((s) => s.snapshot)

  if (!snapshot) return null

  return (
    <aside className="flex flex-col items-center w-12 h-full border-r border-border-subtle bg-surface-raised shrink-0 py-3 gap-1">
      {items.map(({ id, icon: Icon, label }) => {
        const active = viewMode === id
        return (
          <button
            key={id}
            onClick={() => setViewMode(id)}
            title={label}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors group titlebar-no-drag"
          >
            {active && (
              <motion.div
                layoutId="activity-indicator"
                className="absolute inset-0 bg-accent-soft rounded-lg border border-accent/25"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon
              className={`relative w-[18px] h-[18px] transition-colors ${
                active ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
              }`}
            />
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />
            )}
          </button>
        )
      })}
    </aside>
  )
}
