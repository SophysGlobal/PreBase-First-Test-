import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface NetworkControls {
  showArrows: boolean
  labelZoomThreshold: number
  nodeScale: number
  linkWidth: number
  centerForce: number
  repelForce: number
  linkDistance: number
}

interface NetworkControlsStore extends NetworkControls {
  /** Bumped to ask the live network view to re-fit/reset its camera. */
  resetViewNonce: number
  set: (patch: Partial<NetworkControls>) => void
  requestResetView: () => void
  reset: () => void
}

const DEFAULTS: NetworkControls = {
  showArrows: false,
  labelZoomThreshold: 2.2,
  nodeScale: 1,
  linkWidth: 0.6,
  centerForce: 0.45,
  repelForce: -150,
  linkDistance: 48
}

export const useNetworkControls = create<NetworkControlsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      resetViewNonce: 0,
      set: (patch) => set(patch),
      requestResetView: () => set((s) => ({ resetViewNonce: s.resetViewNonce + 1 })),
      reset: () => set({ ...DEFAULTS })
    }),
    { name: 'prebase:network-controls-v2' }
  )
)
