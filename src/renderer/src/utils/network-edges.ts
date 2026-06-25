/**
 * Network Graph edge rendering helpers.
 * Architecture Graph uses variant-based styling in edge-render-strategy.ts instead.
 */
export {
  classifyEdgeCategory,
  edgeMatchesVisibleCategories,
  getEdgeCategoryColor,
  getEdgeCategoryDefinition,
  DEFAULT_VISIBLE_EDGE_CATEGORIES,
  MAX_VISIBLE_EDGE_CATEGORIES,
  type GraphEdgeCategory
} from './edge-categories'
