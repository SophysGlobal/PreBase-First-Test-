import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

function ArchitectureEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        transition: 'stroke 0.25s ease, stroke-width 0.25s ease, filter 0.25s ease'
      }}
      markerEnd={markerEnd}
      interactionWidth={24}
    />
  )
}

export const ArchitectureEdge = memo(ArchitectureEdgeComponent)
