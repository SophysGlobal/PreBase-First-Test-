/** Yaw = rotation around vertical (Y) axis; pitch = rotation around horizontal (X) axis. */
export interface Rotation3D {
  yaw: number
  pitch: number
}

const MAX_PITCH = Math.PI / 2 - 0.12
const FOCAL_LENGTH = 1100

export function clampPitch(pitch: number): number {
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))
}

/**
 * Rotate a point relative to the origin by pitch (X) then yaw (Y), then apply
 * mild perspective so the graph reads as a 3D object rather than a flat spin.
 */
export function projectRotatedPoint(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  focal = FOCAL_LENGTH
): { x: number; y: number; z: number; depthScale: number } {
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const y1 = y * cp - z * sp
  const z1 = y * sp + z * cp
  const x1 = x

  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x2 = x1 * cy + z1 * sy
  const z2 = -x1 * sy + z1 * cy
  const y2 = y1

  const depthScale = focal / (focal + z2)
  return {
    x: x2 * depthScale,
    y: y2 * depthScale,
    z: z2,
    depthScale
  }
}

export function applyGraphRotation3D(
  baseX: number,
  baseY: number,
  centroidX: number,
  centroidY: number,
  rotation: Rotation3D
): { x: number; y: number; z: number; depthScale: number } {
  const lx = baseX - centroidX
  const ly = baseY - centroidY
  const projected = projectRotatedPoint(lx, ly, 0, rotation.yaw, rotation.pitch)
  return {
    x: centroidX + projected.x,
    y: centroidY + projected.y,
    z: projected.z,
    depthScale: projected.depthScale
  }
}
