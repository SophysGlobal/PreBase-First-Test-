import {
  EDGE_CATEGORY_DEFINITIONS,
  MAX_VISIBLE_EDGE_CATEGORIES
} from '../../utils/edge-categories'
import { useSettingsStore } from '../../state/settings-store'
import { InfoTooltip } from '../ui/InfoTooltip'

/** Network graph edge category selector (max 2 visible types). */
export function EdgeCategoryPanel({ embedded = false }: { embedded?: boolean }) {
  const visible = useSettingsStore((s) => s.visibleEdgeCategories)
  const toggle = useSettingsStore((s) => s.toggleVisibleEdgeCategory)

  const content = (
    <>
      {!embedded && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Edge categories</p>
            <span className="text-[9px] text-text-muted tabular-nums">
              {visible.length}/{MAX_VISIBLE_EDGE_CATEGORIES}
            </span>
          </div>
          <p className="text-[10px] text-text-muted leading-snug">
            Select up to {MAX_VISIBLE_EDGE_CATEGORIES} relationship types to show on the graph.
          </p>
        </>
      )}
      <div className="grid grid-cols-1 gap-1">
        {EDGE_CATEGORY_DEFINITIONS.map((cat) => {
          const selected = visible.includes(cat.id)
          const disabled = !selected && visible.length >= MAX_VISIBLE_EDGE_CATEGORIES
          return (
            <button
              key={cat.id}
              type="button"
              title={cat.description}
              disabled={disabled}
              onClick={() => toggle(cat.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors border ${
                selected
                  ? 'border-accent/35 bg-accent/10 text-text-primary'
                  : disabled
                    ? 'border-transparent bg-surface-muted/20 text-text-muted/50 cursor-not-allowed'
                    : 'border-transparent bg-surface-overlay/40 text-text-muted hover:text-text-secondary hover:bg-surface-muted/50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/10"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-[10px] font-medium flex-1 min-w-0 truncate">{cat.label}</span>
              <InfoTooltip title={cat.label} body={cat.description} side="right" />
            </button>
          )
        })}
      </div>
    </>
  )

  if (embedded) {
    return <div className="space-y-1.5">{content}</div>
  }

  return (
    <div className="space-y-1.5 px-0.5 pt-0.5 border-t border-border-subtle">{content}</div>
  )
}
