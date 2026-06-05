/** Runtime layout tuning passed from settings into the layout engine. */
export interface LayoutRuntimeConfig {
  layerRadiusScale: number
  maxNodesPerLayer: number
  layerGap: number
  centerClearance: number
  scatterRelaxIterations: number
  /** Multiplier from sidebar spacing control (compact / balanced / spacious). */
  spacingScale: number
}

export const DEFAULT_LAYOUT_RUNTIME: LayoutRuntimeConfig = {
  layerRadiusScale: 1,
  maxNodesPerLayer: 12,
  layerGap: 168,
  centerClearance: 140,
  scatterRelaxIterations: 22,
  spacingScale: 1
}

export function mergeLayoutRuntime(
  partial?: Partial<LayoutRuntimeConfig>
): LayoutRuntimeConfig {
  return { ...DEFAULT_LAYOUT_RUNTIME, ...partial }
}
