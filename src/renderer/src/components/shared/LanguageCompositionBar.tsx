import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GraphNode } from '../../../../core/types'
import { computeLanguageStats, type LanguageStat } from '../../utils/language-stats'

interface LanguageCompositionBarProps {
  nodes: GraphNode[]
}

/**
 * Shared language breakdown (graph + code views).
 * Percentages derived from scanned file nodes in the project snapshot.
 */
export function LanguageCompositionBar({ nodes }: LanguageCompositionBarProps) {
  const stats = useMemo(() => computeLanguageStats(nodes), [nodes])
  const barRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<LanguageStat | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })

  if (stats.length === 0) return null

  const totalFiles = stats.reduce((s, x) => s + x.count, 0)
  const top = stats.slice(0, 8)
  const otherCount = stats.slice(8).reduce((s, x) => s + x.count, 0)
  const display: LanguageStat[] =
    otherCount > 0
      ? [
          ...top,
          {
            id: 'other-group',
            name: 'Other',
            count: otherCount,
            percent: Math.round((otherCount / totalFiles) * 1000) / 10,
            color: '#52525b'
          }
        ]
      : top

  const showTooltip = (seg: LanguageStat, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    setTooltipPos({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2
    })
    setHovered(seg)
  }

  const hideTooltip = () => setHovered(null)

  return (
    <div className="px-2.5 py-2.5 border-b border-border-subtle bg-surface/30">
      <div className="flex items-center justify-between min-h-[28px] mb-1.5 gap-2">
        <p className="text-[9px] uppercase tracking-wider text-text-muted shrink-0">Languages</p>
        <div className="text-right min-w-0 min-h-[28px] flex flex-col justify-center">
          {hovered ? (
            <>
              <p className="text-[10px] font-medium text-text-primary truncate">{hovered.name}</p>
              <p className="text-[9px] text-text-muted tabular-nums">
                {hovered.percent}% · {hovered.count} file{hovered.count !== 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <p className="text-[9px] text-text-muted tabular-nums">{totalFiles} files</p>
          )}
        </div>
      </div>
      <div
        ref={barRef}
        className="flex h-2.5 rounded-full overflow-hidden bg-surface-muted/80 border border-border-subtle/40"
        role="img"
        aria-label="Project language composition"
        onMouseLeave={hideTooltip}
      >
        {display.map((seg) => (
          <div
            key={seg.id}
            className="h-full cursor-default hover:brightness-110"
            style={{
              width: `${Math.max(seg.percent, seg.count > 0 ? 2 : 0)}%`,
              backgroundColor: seg.color
            }}
            onMouseEnter={(e) => showTooltip(seg, e.currentTarget)}
          />
        ))}
      </div>
      {hovered &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] -translate-x-1/2 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-[#0f1012] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            <p className="text-[10px] font-medium text-text-primary whitespace-nowrap">{hovered.name}</p>
            <p className="text-[9px] text-text-muted tabular-nums text-center">
              {hovered.percent}% · {hovered.count} file{hovered.count !== 1 ? 's' : ''}
            </p>
          </div>,
          document.body
        )}
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5">
        {top.slice(0, 5).map((seg) => (
          <span key={seg.id} className="text-[9px] text-text-muted">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
              style={{ backgroundColor: seg.color }}
            />
            {seg.name} {seg.percent}%
          </span>
        ))}
      </div>
    </div>
  )
}
