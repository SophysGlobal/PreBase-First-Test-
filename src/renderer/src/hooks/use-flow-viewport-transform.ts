import { useEffect, useState } from 'react'
import { useStoreApi } from '@xyflow/react'

/** Live React Flow viewport transform — updates on every pan/zoom frame (no debounce). */
export function useFlowViewportTransform(enabled = true): [number, number, number] {
  const store = useStoreApi()
  const [transform, setTransform] = useState<[number, number, number]>(() => {
    const t = store.getState().transform
    return [t[0], t[1], t[2]]
  })

  useEffect(() => {
    if (!enabled) return

    const sync = () => {
      const t = store.getState().transform
      setTransform((prev) => {
        if (prev[0] === t[0] && prev[1] === t[1] && prev[2] === t[2]) return prev
        return [t[0], t[1], t[2]]
      })
    }

    sync()
    return store.subscribe((state, prev) => {
      const t = state.transform
      const pt = prev.transform
      if (t[0] === pt[0] && t[1] === pt[1] && t[2] === pt[2]) return
      sync()
    })
  }, [enabled, store])

  return transform
}
