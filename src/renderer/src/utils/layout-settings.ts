import type { LayoutRuntimeConfig } from '../../../core/layout/layout-config'
import type { AppSettings, LayoutSpacing } from '../state/settings-store'

export function layoutSpacingScale(spacing: LayoutSpacing): number {
  switch (spacing) {
    case 'compact':
      return 0.82
    case 'spacious':
      return 1.24
    case 'balanced':
    default:
      return 1
  }
}

/** Map persisted settings into layout engine runtime options. */
export function layoutRuntimeFromSettings(settings: AppSettings): LayoutRuntimeConfig {
  const spacingScale = layoutSpacingScale(settings.layoutSpacing)
  return {
    layerRadiusScale: settings.layerRadiusScale,
    maxNodesPerLayer: settings.maxNodesPerLayer,
    layerGap: Math.round(settings.layerGap * spacingScale),
    centerClearance: Math.round(settings.centerClearance * spacingScale),
    scatterRelaxIterations: settings.scatterRelaxIterations,
    spacingScale,
    organizationMethod: settings.layoutOrganizationMethod
  }
}
