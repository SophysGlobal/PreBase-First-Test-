import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { LayoutPosition } from '@core/types'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function posKey(positions: Record<string, LayoutPosition>): string {
  const ids = Object.keys(positions).sort()
  return ids.map((id) => `${id}:${Math.round(positions[id].x)}:${Math.round(positions[id].y)}`).join('|')
}

/**
 * Smoothly animates node positions when snapshot layout changes.
 * Returns true while a transition is running (for skipping camera reset).
 */
export function useLayoutTransition(
  positions: Record<string, LayoutPosition> | undefined,
  enabled: boolean,
  durationMs: number,
  shellRef?: RefObject<HTMLDivElement | null>,
  layoutTransitionRef?: React.MutableRefObject<boolean>,
  onTransitionEnd?: () => void
): boolean {
  const { getNodes, setNodes } = useReactFlow()
  const prevKeyRef = useRef<string>('')
  const fromRef = useRef<Record<string, LayoutPosition>>({})
  const rafRef = useRef(0)
  const runningRef = useRef(false)

  const setTransitionShell = (active: boolean) => {
    const shell = shellRef?.current
    if (shell) shell.classList.toggle('is-layout-transitioning', active)
    if (layoutTransitionRef) layoutTransitionRef.current = active
  }

  useEffect(() => {
    if (!positions || !enabled || durationMs <= 0) {
      runningRef.current = false
      setTransitionShell(false)
      return
    }

    const key = posKey(positions)
    if (key === prevKeyRef.current) return

    const nodes = getNodes()
    if (nodes.length === 0 || prevKeyRef.current === '') {
      prevKeyRef.current = key
      fromRef.current = { ...positions }
      return
    }

    prevKeyRef.current = key
    const from: Record<string, LayoutPosition> = {}
    for (const n of nodes) {
      from[n.id] = { x: n.position.x, y: n.position.y }
    }
    fromRef.current = from
    const to = positions
    const start = performance.now()
    runningRef.current = true
    setTransitionShell(true)

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const e = easeOutCubic(t)

      setNodes((current) =>
        current.map((n) => {
          const a = from[n.id]
          const b = to[n.id]
          if (!a || !b) return n
          return {
            ...n,
            position: {
              x: a.x + (b.x - a.x) * e,
              y: a.y + (b.y - a.y) * e
            }
          }
        })
      )

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        runningRef.current = false
        setTransitionShell(false)
        rafRef.current = 0
        onTransitionEnd?.()
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      runningRef.current = false
      setTransitionShell(false)
    }
  }, [positions, enabled, durationMs, getNodes, setNodes, shellRef, layoutTransitionRef, onTransitionEnd])

  return runningRef.current
}

/** Node center in graph coordinates (for transition start capture). */
export function nodeCenterFromPos(
  id: string,
  positions: Record<string, LayoutPosition>
): LayoutPosition {
  const p = positions[id]
  if (!p) return { x: 0, y: 0 }
  return { x: p.x, y: p.y }
}
