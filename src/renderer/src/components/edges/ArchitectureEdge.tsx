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
  const strokeWidth = Number(style.strokeWidth ?? 1.1)
  const opacity = Number(style.opacity ?? 0.9)

  return (
    <g className="react-flow__edge">
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        // Edges are non-interactive: no hit area, no pointer events. This stops
        // the cursor from triggering edge repaints while sweeping the graph
        // (a primary flicker source). Relationship info lives in the inspector.
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
