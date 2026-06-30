import { isUnreachableDepth } from '../../../core/layout/dependency-depth'

export function ringLayerTitle(
  depth: number,
  ringIndex: number,
  subRingCount = 1
): string {
  if (isUnreachableDepth(depth)) {
    return ringIndex > 0
      ? `Unlinked / Other · overflow ${String.fromCharCode(65 + ringIndex)}`
      : 'Unlinked / Other'
  }
  if (depth === 0) return 'Entry / Root'
  if (ringIndex > 0) {
    const label = subRingCount > 1 ? String.fromCharCode(65 + ringIndex) : String(ringIndex + 1)
    return `Depth ${depth}, overflow ring ${label}`
  }
  return `Depth ${depth}`
}

export function pyramidLayerTitle(depth: number): string {
  if (isUnreachableDepth(depth)) return 'Unlinked / Other'
  if (depth === 0) return 'Entry / Root'
  return depth === 1 ? 'Depth 1 — Direct connections' : `Depth ${depth}`
}

export function ringLayerExplanation(depth: number, ringIndex: number): string {
  if (isUnreachableDepth(depth)) {
    return ringIndex > 0
      ? 'Overflow ring for files not reachable from the entry point. Same unlinked group; split for readability.'
      : 'These files are not reachable from the detected entry point through the import relationship graph.'
  }
  if (depth === 1) {
    return 'These files are one relationship step away from the entry file — the shortest path from entry to each file is 1.'
  }
  if (ringIndex > 0) {
    return `This is an additional ring for Depth ${depth} because Depth ${depth} contains too many files to display clearly in one ring. Files here share the same entry-point distance.`
  }
  return `These files are ${depth} relationship step${depth === 1 ? '' : 's'} away from the entry file. They are grouped here because the shortest path from the entry file to each file is ${depth}.`
}

export function pyramidLayerExplanation(depth: number): string {
  if (isUnreachableDepth(depth)) {
    return 'These files are not reachable from the detected entry point through the import relationship graph. They appear in the outermost pyramid layer.'
  }
  if (depth === 1) {
    return 'These files are one relationship step away from the entry file. In Pyramid layout, direct connections appear directly below the entry.'
  }
  return `These files are ${depth} relationship step${depth === 1 ? '' : 's'} away from the entry file. In Pyramid layout, deeper files appear lower in the graph.`
}

export function organizationMethodLabel(): string {
  return 'Entry-point distance (shortest path)'
}
