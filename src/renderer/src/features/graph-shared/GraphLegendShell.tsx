import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/** Floating legend card with integrated header (no separate title pill). */
export function GraphLegendShell({
  collapsed,
  onToggle,
  className,
  children
}: {
  collapsed: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`pointer-events-auto ${className ?? ''}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl border border-border-subtle bg-[#141518] shadow-[0_4px_24px_rgba(0,0,0,0.5)] w-fit min-w-[168px] max-w-[min(100vw-5rem,240px)] overflow-hidden inline-flex flex-col">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-2.5 py-1.5 border-b border-border-subtle/80 text-left hover:bg-surface-muted/40 transition-colors"
        >
          <span className="text-[11px] font-medium text-text-secondary">Legend</span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
          )}
        </button>
        {!collapsed && children ? (
          <div className="px-2 py-1.5 overflow-y-auto sidebar-scroll max-h-[min(36vh,260px)]">
            <div className="flex flex-col gap-0">{children}</div>
          </div>
        ) : null}
      </div>
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
    <p className="text-[9px] uppercase tracking-wider text-text-muted px-1 pt-1 pb-0 first:pt-0 first:border-t-0 border-t border-border-subtle/40">
      {children}
    </p>
  )
}
