import type { NetworkLink, NetworkNode } from './network-model'

export type NetworkLayoutMode =
  | 'organic'
  | 'sphere'
  | 'constellation'
  | 'clustered'
  | 'radial'

export interface Point3D {
  x: number
  y: number
  z: number
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function clampToSphere(p: Point3D, maxRadius: number): Point3D {
  const d = Math.hypot(p.x, p.y, p.z)
  if (d <= maxRadius || d === 0) return p
  const k = maxRadius / d
  return { x: p.x * k, y: p.y * k, z: p.z * k }
}

function centerPositions(positions: Map<string, Point3D>): void {
  let sx = 0
  let sy = 0
  let sz = 0
  const n = positions.size
  if (!n) return
  for (const p of positions.values()) {
    sx += p.x
    sy += p.y
    sz += p.z
  }
  const inv = 1 / n
  sx *= inv
  sy *= inv
  sz *= inv
  for (const [id, p] of positions) {
    positions.set(id, { x: p.x - sx, y: p.y - sy, z: p.z - sz })
  }
}

function relaxLinks(
  positions: Map<string, Point3D>,
  links: NetworkLink[],
  sphereRadius: number,
  passes: number,
  pull: number
): void {
  for (let pass = 0; pass < passes; pass++) {
    for (const link of links) {
      const s = positions.get(link.source)
      const t = positions.get(link.target)
      if (!s || !t) continue
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dz = t.z - s.z
      s.x += dx * pull
      s.y += dy * pull
      s.z += dz * pull
      t.x -= dx * pull
      t.y -= dy * pull
      t.z -= dz * pull
      positions.set(link.source, clampToSphere(s, sphereRadius))
      positions.set(link.target, clampToSphere(t, sphereRadius))
    }
  }
}

function fibonacciShell(
  nodes: NetworkNode[],
  sphereRadius: number,
  radialFn: (node: NetworkNode, index: number, total: number) => number
): Map<string, Point3D> {
  const positions = new Map<string, Point3D>()
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const node = nodes[i]
    const t = (i + 0.5) / Math.max(1, n)
    const y = 1 - 2 * t
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GOLDEN_ANGLE * i
    const radial = sphereRadius * radialFn(node, i, n)
    positions.set(
      node.id,
      clampToSphere(
        {
          x: Math.cos(theta) * ring * radial,
          y: y * radial * 0.92,
          z: Math.sin(theta) * ring * radial
        },
        sphereRadius
      )
    )
  }
  return positions
}

/** Balanced startup cloud — uniform fibonacci shell with light link relaxation. */
function layoutOrganic(
  nodes: NetworkNode[],
  links: NetworkLink[],
  sphereRadius: number
): Map<string, Point3D> {
  const positions = fibonacciShell(nodes, sphereRadius, (_node, i, total) => {
    const t = (i + 0.5) / Math.max(1, total)
    return 0.84 + 0.1 * (1 - Math.abs(t - 0.5) * 1.6)
  })
  relaxLinks(positions, links, sphereRadius, 14, 0.042)
  centerPositions(positions)
  return positions
}

function layoutSphere(
  nodes: NetworkNode[],
  links: NetworkLink[],
  sphereRadius: number
): Map<string, Point3D> {
  const positions = fibonacciShell(nodes, sphereRadius, () => 0.96)
  relaxLinks(positions, links, sphereRadius, 5, 0.022)
  centerPositions(positions)
  return positions
}

function layoutConstellation(
  nodes: NetworkNode[],
  links: NetworkLink[],
  sphereRadius: number
): Map<string, Point3D> {
  const positions = fibonacciShell(nodes, sphereRadius, (node, i) =>
    0.35 + 0.45 * (((node.id.charCodeAt(0) + i * 7) % 97) / 97)
  )
  relaxLinks(positions, links, sphereRadius, 22, 0.06)
  centerPositions(positions)
  return positions
}

function layoutClustered(
  nodes: NetworkNode[],
  links: NetworkLink[],
  sphereRadius: number
): Map<string, Point3D> {
  const groups = new Map<string, NetworkNode[]>()
  for (const node of nodes) {
    const key = node.fileTypeId || 'other'
    const list = groups.get(key) ?? []
    list.push(node)
    groups.set(key, list)
  }

  const clusterKeys = [...groups.keys()]
  const positions = new Map<string, Point3D>()
  const clusterRadius = sphereRadius * 0.72

  clusterKeys.forEach((key, ci) => {
    const members = groups.get(key) ?? []
    const t = (ci + 0.5) / Math.max(1, clusterKeys.length)
    const cy = 1 - 2 * t
    const ring = Math.sqrt(Math.max(0, 1 - cy * cy))
    const theta = GOLDEN_ANGLE * ci
    const cx = Math.cos(theta) * ring * clusterRadius
    const cz = Math.sin(theta) * ring * clusterRadius
    const localR = Math.min(sphereRadius * 0.32, 48 + members.length * 5)

    members.forEach((node, mi) => {
      const lt = (mi + 0.5) / Math.max(1, members.length)
      const ly = 1 - 2 * lt
      const lring = Math.sqrt(Math.max(0, 1 - ly * ly))
      const ltheta = GOLDEN_ANGLE * mi
      positions.set(
        node.id,
        clampToSphere(
          {
            x: cx + Math.cos(ltheta) * lring * localR,
            y: cy * clusterRadius * 0.35 + ly * localR * 0.55,
            z: cz + Math.sin(ltheta) * lring * localR
          },
          sphereRadius
        )
      )
    })
  })

  relaxLinks(positions, links, sphereRadius, 8, 0.035)
  centerPositions(positions)
  return positions
}

function layoutRadial(
  nodes: NetworkNode[],
  links: NetworkLink[],
  sphereRadius: number
): Map<string, Point3D> {
  const sorted = [...nodes].sort((a, b) => b.val - a.val)
  const positions = new Map<string, Point3D>()
  const n = sorted.length

  for (let i = 0; i < n; i++) {
    const node = sorted[i]
    const t = (i + 0.5) / Math.max(1, n)
    const y = 1 - 2 * t
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GOLDEN_ANGLE * i * 1.07
    const radial = sphereRadius * (0.22 + 0.78 * Math.pow(i / Math.max(1, n - 1), 0.65))
    positions.set(
      node.id,
      clampToSphere(
        {
          x: Math.cos(theta) * ring * radial,
          y: y * radial * 0.85,
          z: Math.sin(theta) * ring * radial
        },
        sphereRadius
      )
    )
  }

  relaxLinks(positions, links, sphereRadius, 6, 0.03)
  centerPositions(positions)
  return positions
}

export function layoutNetworkGraph(
  mode: NetworkLayoutMode,
  nodes: NetworkNode[],
  links: NetworkLink[],
  sphereRadius = 240
): Map<string, Point3D> {
  switch (mode) {
    case 'sphere':
      return layoutSphere(nodes, links, sphereRadius)
    case 'constellation':
      return layoutConstellation(nodes, links, sphereRadius)
    case 'clustered':
      return layoutClustered(nodes, links, sphereRadius)
    case 'radial':
      return layoutRadial(nodes, links, sphereRadius)
    case 'organic':
    default:
      return layoutOrganic(nodes, links, sphereRadius)
  }
}

export const NETWORK_LAYOUT_OPTIONS: {
  id: NetworkLayoutMode
  label: string
  blurb: string
}[] = [
  {
    id: 'organic',
    label: 'Organic',
    blurb: 'Balanced natural cloud — default startup arrangement.'
  },
  {
    id: 'sphere',
    label: 'Sphere',
    blurb: 'Tight even 3D shell with minimal link pull.'
  },
  {
    id: 'constellation',
    label: 'Constellation',
    blurb: 'Connected files pull closer in 3D space.'
  },
  {
    id: 'clustered',
    label: 'Clustered',
    blurb: 'Groups by file type in separate 3D clusters.'
  },
  {
    id: 'radial',
    label: 'Radial',
    blurb: 'Important files near center, others outward.'
  }
]
