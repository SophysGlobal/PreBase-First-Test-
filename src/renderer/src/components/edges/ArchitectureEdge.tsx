import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { EdgeVisualVariant } from '../../utils/flow-adapter'

function ArchitectureEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data
  } = props

  const variant = (data as { variant?: EdgeVisualVariant; curvature?: number })?.variant ?? 'import'
  const curvature =
    (data as { curvature?: number })?.curvature ??
    (variant === 'dynamic' ? 0.35 : 0.28)

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature
  })

  const stroke = (style.stroke as string) ?? 'rgba(255,255,255,0.35)'
  const strokeWidth = Number(style.strokeWidth ?? 1.15)
  const opacity = Number(style.opacity ?? 0.9)

  // Dark halo behind edge improves contrast over colored ring backgrounds
  const haloWidth = strokeWidth + 3.2
  const isDashed = (style as { strokeDasharray?: string }).strokeDasharray != null ||
    variant === 'dynamic' || variant === 'utility' || variant === 'folder-link' || variant === 'contains'

  return (
    <g className="react-flow__edge" style={{ pointerEvents: 'none' }}>
      {/* Dark contrast halo rendered beneath the colored edge */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(6,6,8,0.72)"
        strokeWidth={haloWidth}
        strokeLinecap="round"
        strokeDasharray={isDashed ? (style as { strokeDasharray?: string }).strokeDasharray : undefined}
        opacity={Math.min(1, opacity * 0.95)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={0}
        className="react-flow__edge-path"
        style={{
          ...style,
          stroke,
          strokeWidth,
          opacity,
          fill: 'none',
          pointerEvents: 'none'
        }}
      />
    </g>
  )
}

export const ArchitectureEdge = memo(ArchitectureEdgeComponent)
