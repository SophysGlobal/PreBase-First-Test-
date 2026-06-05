import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NetworkLayoutMode } from '../utils/network-layout'

export interface NetworkControls {
  showArrows: boolean
  labelZoomThreshold: number
  nodeScale: number
  linkWidth: number
  centerForce: number
  repelForce: number
  linkDistance: number
  layoutMode: NetworkLayoutMode
  /** Multiplier for 3D node spread (compact ↔ spacious). */
  spreadScale: number
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
  linkDistance: 48,
  layoutMode: 'organic',
  spreadScale: 1
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
    {
      name: 'prebase:network-controls-v5',
      merge: (persisted, current) => {
        const p = persisted as Partial<NetworkControls>
        const mode = p.layoutMode ?? 'organic'
        const valid = ['organic', 'sphere', 'constellation', 'clustered', 'radial'] as const
        return {
          ...current,
          ...p,
          layoutMode: valid.includes(mode as (typeof valid)[number]) ? mode : 'organic',
          spreadScale: p.spreadScale ?? 1
        }
      }
    }
  )
)
