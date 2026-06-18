import type { LayoutOrganizationMethod } from '../../../core/layout/layout-organization'
import { ORGANIZATION_METHOD_OPTIONS } from '../constants/graph-help'

export function organizationMethodLabel(method: LayoutOrganizationMethod): string {
  return ORGANIZATION_METHOD_OPTIONS.find((o) => o.id === method)?.label ?? method
}

export function ringLayerTitle(depth: number, ringIndex: number): string {
  if (depth === 1 && ringIndex === 0) return 'Layer 1 — Direct dependencies'
  if (ringIndex > 0) return `Layer ${depth} · Ring ${ringIndex + 1}`
  return `Layer ${depth}`
}

export function ringLayerExplanation(
  depth: number,
  ringIndex: number,
  method: LayoutOrganizationMethod
): string {
  const methodNote = ORGANIZATION_METHOD_OPTIONS.find((o) => o.id === method)?.blurb ?? ''

  if (method === 'dependency-depth') {
    if (depth === 1) {
      return 'Files directly imported or referenced by the center/root node. These are your immediate dependencies.'
    }
    if (ringIndex > 0) {
      return `Sub-ring ${ringIndex + 1} at dependency depth ${depth} — extra files at this depth split into readable arcs.`
    }
    return `Dependency depth ${depth}: files reached through ${depth} import hop${depth === 1 ? '' : 's'} from the entry point.`
  }

  if (method === 'import-importance') {
    if (depth === 1) {
      return 'Highly imported files ranked closest to the center — hubs and shared modules.'
    }
    return ringIndex > 0
      ? `Sub-ring at importance tier ${depth} (ring ${ringIndex + 1}).`
      : `Importance tier ${depth}: less frequently imported files on outer rings. ${methodNote}`
  }

  if (method === 'file-role') {
    if (depth === 1) {
      return 'Core architectural roles nearest the entry — routes, shell, and primary UI layers.'
    }
    return ringIndex > 0
      ? `Sub-ring for role tier ${depth} (ring ${ringIndex + 1}).`
      : `Role tier ${depth}: supporting layers (services, utils, config) farther from center. ${methodNote}`
  }

  // directory-proximity
  if (depth === 1) {
    return 'Files in or near the entry folder — closest directory proximity to the root.'
  }
  return ringIndex > 0
    ? `Sub-ring at directory tier ${depth} (ring ${ringIndex + 1}).`
    : `Directory tier ${depth}: files in deeper or more distant folders from the entry path. ${methodNote}`
}
