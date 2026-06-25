import { useCallback, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '../../state/settings-store'
import { InfoTooltip } from '../ui/InfoTooltip'

const sessionKey = (id: string) => `prebase:sidebar-section:${id}`

export function CollapsibleSidebarSection({
  sectionId,
  title,
  hint,
  children,
  className
}: {
  sectionId: string
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  const defaultCollapsed = useSettingsStore((s) => s.collapseSidebarSectionsDefault)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return defaultCollapsed
    const stored = sessionStorage.getItem(sessionKey(sectionId))
    if (stored === '0') return false
    if (stored === '1') return true
    return defaultCollapsed
  })

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      sessionStorage.setItem(sessionKey(sectionId), next ? '1' : '0')
      return next
    })
  }, [sectionId])

  return (
    <div className={`border border-border-subtle rounded-lg overflow-hidden ${className ?? ''}`}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-between w-full px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-text-muted hover:bg-surface-muted/40 transition-colors"
      >
        <span className="flex items-center gap-1">
          {title}
          {hint && <InfoTooltip title={title} body={hint} side="right" />}
        </span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
