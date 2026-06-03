import type { LayoutRuntimeConfig } from '../../../core/layout/layout-config'
import type { AppSettings } from '../state/settings-store'

/** Map persisted settings into layout engine runtime options. */
export function layoutRuntimeFromSettings(settings: AppSettings): LayoutRuntimeConfig {
  return {
    layerRadiusScale: settings.layerRadiusScale,
    maxNodesPerLayer: settings.maxNodesPerLayer,
    layerGap: settings.layerGap,
    centerClearance: settings.centerClearance,
    scatterRelaxIterations: settings.scatterRelaxIterations
  }
}
