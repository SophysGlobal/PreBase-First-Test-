import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface ResizableVerticalSplitProps {
  top: ReactNode
  bottom: ReactNode
  /** Initial top fraction (0–1). */
  initialTopFraction?: number
  minTopPx?: number
  minBottomPx?: number
  storageKey?: string
}

/**
 * Two stacked panes separated by a draggable horizontal divider.
 * Each pane owns its scroll (children must use min-h-0 + overflow).
 */
export function ResizableVerticalSplit({
  top,
  bottom,
  initialTopFraction = 0.55,
  minTopPx = 120,
  minBottomPx = 120,
  storageKey
}: ResizableVerticalSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [topFraction, setTopFraction] = useState(() => {
    if (storageKey) {
      const saved = Number(window.localStorage.getItem(storageKey))
      if (saved > 0.05 && saved < 0.95) return saved
    }
    return initialTopFraction
  })
  const draggingRef = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    draggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const clampedTop = Math.max(minTopPx, Math.min(rect.height - minBottomPx, y))
      const fraction = clampedTop / rect.height
      setTopFraction(fraction)
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      if (storageKey) {
        window.localStorage.setItem(storageKey, String(topFraction))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [minTopPx, minBottomPx, storageKey, topFraction])

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0">
      <div
        className="min-h-0 overflow-hidden flex flex-col"
        style={{ flexBasis: `${topFraction * 100}%`, flexGrow: 0, flexShrink: 0 }}
      >
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        className="group relative h-1.5 shrink-0 cursor-row-resize bg-border-subtle/40 hover:bg-accent/40 transition-colors titlebar-no-drag"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 rounded-full bg-text-muted/40 group-hover:bg-accent/60" />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{bottom}</div>
    </div>
  )
}
