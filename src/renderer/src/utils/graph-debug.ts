/** Dev-only graph instrumentation. Enable with localStorage `prebase:graph-debug=1`. */
export function graphDebug(section: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem('prebase:graph-debug') !== '1') return
  console.debug(`[GraphDebug:${section}]`, data ?? '')
}

let archRenderCount = 0
let lastArchLog = 0

export function debugArchRender(reason: string, extra?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem('prebase:graph-debug') !== '1') return
  archRenderCount++
  const now = performance.now()
  if (now - lastArchLog > 500) {
    console.debug(`[GraphDebug:arch-render] count=${archRenderCount} reason=${reason}`, extra)
    lastArchLog = now
  }
}

let networkMoveCount = 0
let lastNetworkLog = 0

export function debugNetworkDrag(data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem('prebase:graph-debug') !== '1') return
  networkMoveCount++
  const now = performance.now()
  if (now - lastNetworkLog > 200) {
    console.debug(`[GraphDebug:network-drag] moves=${networkMoveCount}`, data)
    lastNetworkLog = now
  }
}

let tileWarnCount = 0

/** Hook into devtools — call from components when graph state changes. */
export function debugTilePressure(context: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem('prebase:graph-debug') !== '1') return
  tileWarnCount++
  if (tileWarnCount % 8 !== 0) return
  console.debug(`[GraphDebug:tile-pressure] ${context}`, data)
}
