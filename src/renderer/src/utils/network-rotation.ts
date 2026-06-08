import type { Point3D } from './network-layout'

/** Unit quaternion orientation for free 3D graph rotation (arcball). */
export interface Orientation3D {
  w: number
  x: number
  y: number
  z: number
}

/** @deprecated Use Orientation3D — kept for inertia/settle hooks that pass yaw/pitch deltas. */
export interface Rotation3D {
  yaw: number
  pitch: number
}

const FOCAL_LENGTH = 1100

export const IDENTITY_ORIENTATION: Orientation3D = { w: 1, x: 0, y: 0, z: 0 }

export function quatNormalize(q: Orientation3D): Orientation3D {
  const len = Math.hypot(q.w, q.x, q.y, q.z) || 1
  return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len }
}

export function quatMultiply(a: Orientation3D, b: Orientation3D): Orientation3D {
  return quatNormalize({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  })
}

export function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Orientation3D {
  const half = angle / 2
  const s = Math.sin(half)
  const len = Math.hypot(ax, ay, az) || 1
  return quatNormalize({
    w: Math.cos(half),
    x: (ax / len) * s,
    y: (ay / len) * s,
    z: (az / len) * s
  })
}

export function rotateVec3(v: Point3D, q: Orientation3D): Point3D {
  const qx = q.x
  const qy = q.y
  const qz = q.z
  const qw = q.w
  const ix = qw * v.x + qy * v.z - qz * v.y
  const iy = qw * v.y + qz * v.x - qx * v.z
  const iz = qw * v.z + qx * v.y - qy * v.x
  const iw = -qx * v.x - qy * v.y - qz * v.z
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx
  }
}

/** Project pointer into arcball sphere coordinates (-1..1, z on hemisphere). */
export function screenToArcball(
  clientX: number,
  clientY: number,
  rect: DOMRect
): Point3D {
  const nx = (2 * (clientX - rect.left)) / Math.max(1, rect.width) - 1
  const ny = 1 - (2 * (clientY - rect.top)) / Math.max(1, rect.height)
  const len2 = nx * nx + ny * ny
  if (len2 > 1) {
    const len = Math.sqrt(len2)
    return { x: nx / len, y: ny / len, z: 0 }
  }
  return { x: nx, y: ny, z: Math.sqrt(Math.max(0, 1 - len2)) }
}

/** Rotation quaternion that drags `from` vector onto `to` on the arcball. */
export function arcballDeltaQuat(from: Point3D, to: Point3D): Orientation3D {
  const dot = from.x * to.x + from.y * to.y + from.z * to.z
  if (dot >= 0.999999) return IDENTITY_ORIENTATION
  if (dot <= -0.999999) {
    const axis = Math.abs(from.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
    return quatFromAxisAngle(axis.x, axis.y, axis.z, Math.PI)
  }
  const cx = from.y * to.z - from.z * to.y
  const cy = from.z * to.x - from.x * to.z
  const cz = from.x * to.y - from.y * to.x
  return quatNormalize({ w: 1 + dot, x: cx, y: cy, z: cz })
}

/** Screen drag → incremental arcball rotation (sensitivity scales pointer movement). */
export function mapScreenDragToArcball(
  dx: number,
  dy: number,
  rect: DOMRect,
  sensitivity: number,
  inverted: boolean
): Orientation3D {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let sdx = dx * sensitivity * 2.4
  let sdy = dy * sensitivity * 2.4
  if (inverted) {
    sdx = -sdx
    sdy = -sdy
  }
  const from = screenToArcball(cx, cy, rect)
  const to = screenToArcball(cx + sdx, cy + sdy, rect)
  return arcballDeltaQuat(from, to)
}

export function applyGraphRotation3D(
  base: Point3D,
  centroidX: number,
  centroidY: number,
  orientation: Orientation3D
): { x: number; y: number; z: number; depthScale: number } {
  const lx = base.x - centroidX
  const ly = base.y - centroidY
  const lz = base.z
  const rotated = rotateVec3({ x: lx, y: ly, z: lz }, orientation)
  const depthScale = FOCAL_LENGTH / (FOCAL_LENGTH + rotated.z)
  return {
    x: centroidX + rotated.x * depthScale,
    y: centroidY + rotated.y * depthScale,
    z: rotated.z,
    depthScale
  }
}

/** Legacy helpers — still used for debug / pitch clamp removal path. */
export function clampPitch(pitch: number): number {
  return pitch
}

export function mapScreenDragToRotation(
  dx: number,
  dy: number,
  _rotation: Rotation3D,
  sensitivity: number,
  inverted: boolean
): { yaw: number; pitch: number } {
  let yaw = dx * sensitivity
  let pitch = dy * sensitivity
  if (inverted) {
    yaw = -yaw
    pitch = -pitch
  }
  return { yaw, pitch }
}

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
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x2 = x * cy + z1 * sy
  const z2 = -x * sy + z1 * cy
  const depthScale = focal / (focal + z2)
  return { x: x2 * depthScale, y: y1 * depthScale, z: z2, depthScale }
}
