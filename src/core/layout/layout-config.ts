/** Runtime layout tuning passed from settings into the layout engine. */
export interface LayoutRuntimeConfig {
  layerRadiusScale: number
  maxNodesPerLayer: number
  layerGap: number
  centerClearance: number
  scatterRelaxIterations: number
}

export const DEFAULT_LAYOUT_RUNTIME: LayoutRuntimeConfig = {
  layerRadiusScale: 1,
  maxNodesPerLayer: 24,
  layerGap: 132,
  centerClearance: 108,
  scatterRelaxIterations: 10
}

export function mergeLayoutRuntime(
  partial?: Partial<LayoutRuntimeConfig>
): LayoutRuntimeConfig {
  return { ...DEFAULT_LAYOUT_RUNTIME, ...partial }
}
