import { memo, useState } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export type EdgeVariant = 'static' | 'dynamic' | 'highlighted' | 'selected'

function ArchitectureEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data
}: EdgeProps) {
  const variant = (data as { variant?: EdgeVariant })?.variant ?? 'static'
  const [hovered, setHovered] = useState(false)

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: variant === 'dynamic' ? 0.35 : 0.25
  })

  const strokeDasharray = variant === 'dynamic' ? '6 4' : undefined
  const interactionWidth = hovered ? 18 : 6

  return (
    <g
      className={`react-flow__edge edge-hoverable ${hovered ? 'edge-hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeDasharray,
          strokeWidth: hovered
            ? Math.max(1.25, Number(style?.strokeWidth ?? 1) + 0.35)
            : style?.strokeWidth,
          opacity: hovered ? 1 : style?.opacity,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease'
        }}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
      />
    </g>
  )
}

export const ArchitectureEdge = memo(ArchitectureEdgeComponent)
