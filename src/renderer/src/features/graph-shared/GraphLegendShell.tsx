import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/** Vertical floating legend — expands upward, collapses downward toward zoom controls. */
export function GraphLegendShell({
  title,
  collapsed,
  onToggle,
  className,
  children
}: {
  title: string
  collapsed: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`pointer-events-auto flex flex-col-reverse items-start gap-1.5 ${className ?? ''}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!collapsed && (
        <div className="rounded-xl border border-border-subtle bg-[#141518]/96 shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-2.5 w-[min(100vw-5rem,240px)] max-h-[min(42vh,300px)] overflow-y-auto sidebar-scroll">
          <div className="grid grid-cols-1 gap-1">{children}</div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-[#141518]/95 shadow-[0_4px_16px_rgba(0,0,0,0.35)] text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
      >
        {title}
        {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>
    </div>
  )
}

export function LegendChip({
  color,
  label,
  dashed
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2 px-1 py-0.5 rounded-md shrink-0 w-full">
      {dashed ? (
        <span className="w-4 h-0 border-t-2 border-dashed shrink-0" style={{ borderColor: color }} />
      ) : (
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/10"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-[10px] text-text-secondary leading-snug">{label}</span>
    </span>
  )
}

export function LegendSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-wider text-text-muted px-1 pt-1 pb-0.5 border-t border-border-subtle/50 first:border-t-0 first:pt-0">
      {children}
    </p>
  )
}
