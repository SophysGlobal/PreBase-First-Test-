import { useCallback, useMemo, useRef } from 'react'
import { clampPitch, type Rotation3D } from '../utils/network-rotation'
import { debugNetworkDrag } from '../utils/graph-debug'

const DAMPING = 0.88
const MAX_VELOCITY = 0.09
const STOP_EPSILON = 0.00025
/** Radians per pixel — horizontal drag → yaw, vertical drag → pitch. */
const ROT_SENSITIVITY = 0.0045

export interface OrbitAttachOptions {
  /** Called synchronously on every rotation change (drag + momentum). */
  onRotate?: (rotation: Rotation3D) => void
  /** Called once when an empty-space rotation drag is confirmed. */
  onDragStart?: () => void
  /** Called when drag/momentum fully stops. */
  onDragEnd?: () => void
}

export interface OrbitStep {
  rotation: Rotation3D
  moving: boolean
}

/**
 * Trackball-style 3D orbit for the network graph.
 * Horizontal drag → yaw (Y axis). Vertical drag → pitch (X axis).
 * Updates fire synchronously on pointermove; RAF handles post-release inertia only.
 */
export function useNetworkOrbit(reduceMotion: boolean) {
  const rotationRef = useRef<Rotation3D>({ yaw: 0, pitch: 0 })
  const velRef = useRef({ yaw: 0, pitch: 0 })

  const draggingRef = useRef(false)
  const armedRef = useRef(false)
  const lastPtrRef = useRef({ x: 0, y: 0 })
  const hoveredNodeRef = useRef(false)
  const movedRef = useRef(0)
  const activePointerIdRef = useRef<number | null>(null)
  const optionsRef = useRef<OrbitAttachOptions>({})

  const DRAG_THRESHOLD = 2

  const setAttachOptions = useCallback((opts: OrbitAttachOptions) => {
    optionsRef.current = opts
  }, [])

  const setHovered = useCallback((hovered: boolean) => {
    hoveredNodeRef.current = hovered
  }, [])

  const emitRotate = useCallback((rotation: Rotation3D) => {
    optionsRef.current.onRotate?.(rotation)
  }, [])

  const attach = useCallback(
    (root: HTMLElement | null) => {
      if (!root) return undefined

      const isCanvasTarget = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return false
        return target.tagName === 'CANVAS' && root.contains(target)
      }

      const clearWindowListeners = () => {
        window.removeEventListener('pointermove', onWindowPointerMove, true)
        window.removeEventListener('pointerup', onWindowPointerUp, true)
        window.removeEventListener('pointercancel', onWindowPointerUp, true)
      }

      const applyRotateDelta = (deltaYaw: number, deltaPitch: number) => {
        if (deltaYaw === 0 && deltaPitch === 0) return
        const next = {
          yaw: rotationRef.current.yaw + deltaYaw,
          pitch: clampPitch(rotationRef.current.pitch + deltaPitch)
        }
        rotationRef.current = next
        velRef.current = {
          yaw: Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, deltaYaw)),
          pitch: Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, deltaPitch))
        }
        emitRotate(next)
        debugNetworkDrag({ deltaYaw, deltaPitch, ...next, dragging: true })
      }

      const onPointerMove = (e: PointerEvent) => {
        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
          return
        }
        if (!armedRef.current && !draggingRef.current) return

        const dx = e.clientX - lastPtrRef.current.x
        const dy = e.clientY - lastPtrRef.current.y
        lastPtrRef.current = { x: e.clientX, y: e.clientY }
        movedRef.current += Math.abs(dx) + Math.abs(dy)

        if (!draggingRef.current) {
          if (movedRef.current < DRAG_THRESHOLD) return
          draggingRef.current = true
          optionsRef.current.onDragStart?.()
        }

        applyRotateDelta(dx * ROT_SENSITIVITY, dy * ROT_SENSITIVITY)
      }

      const onWindowPointerMove = (e: PointerEvent) => onPointerMove(e)

      const finishGesture = (e: PointerEvent) => {
        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
          return
        }
        armedRef.current = false
        draggingRef.current = false
        activePointerIdRef.current = null
        clearWindowListeners()
      }

      const onWindowPointerUp = (e: PointerEvent) => finishGesture(e)

      const onPointerDown = (e: PointerEvent) => {
        if (!isCanvasTarget(e.target)) return
        if (hoveredNodeRef.current) return
        if (e.button !== 0) return

        movedRef.current = 0
        activePointerIdRef.current = e.pointerId
        velRef.current = { yaw: 0, pitch: 0 }
        armedRef.current = true
        lastPtrRef.current = { x: e.clientX, y: e.clientY }

        clearWindowListeners()
        window.addEventListener('pointermove', onWindowPointerMove, true)
        window.addEventListener('pointerup', onWindowPointerUp, true)
        window.addEventListener('pointercancel', onWindowPointerUp, true)

        debugNetworkDrag({ event: 'pointerdown', target: (e.target as Element)?.tagName })
      }

      const onContextMenu = (ev: Event) => ev.preventDefault()

      root.addEventListener('pointerdown', onPointerDown, { capture: true })
      root.addEventListener('contextmenu', onContextMenu)

      return () => {
        clearWindowListeners()
        root.removeEventListener('pointerdown', onPointerDown, { capture: true })
        root.removeEventListener('contextmenu', onContextMenu)
      }
    },
    [emitRotate]
  )

  /** Momentum integration — only runs when NOT actively dragging. */
  const step = useCallback((): OrbitStep => {
    if (draggingRef.current) {
      return { rotation: rotationRef.current, moving: true }
    }

    if (
      !reduceMotion &&
      (Math.abs(velRef.current.yaw) > STOP_EPSILON || Math.abs(velRef.current.pitch) > STOP_EPSILON)
    ) {
      const next = {
        yaw: rotationRef.current.yaw + velRef.current.yaw,
        pitch: clampPitch(rotationRef.current.pitch + velRef.current.pitch)
      }
      rotationRef.current = next
      emitRotate(next)
      velRef.current = {
        yaw: velRef.current.yaw * DAMPING,
        pitch: velRef.current.pitch * DAMPING
      }
      velRef.current.yaw = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velRef.current.yaw))
      velRef.current.pitch = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velRef.current.pitch))
      if (Math.abs(velRef.current.yaw) < STOP_EPSILON) velRef.current.yaw = 0
      if (Math.abs(velRef.current.pitch) < STOP_EPSILON) velRef.current.pitch = 0
    } else if (velRef.current.yaw !== 0 || velRef.current.pitch !== 0) {
      velRef.current = { yaw: 0, pitch: 0 }
      optionsRef.current.onDragEnd?.()
    }

    const moving =
      draggingRef.current ||
      Math.abs(velRef.current.yaw) > STOP_EPSILON ||
      Math.abs(velRef.current.pitch) > STOP_EPSILON

    return { rotation: rotationRef.current, moving }
  }, [reduceMotion, emitRotate])

  const isDragging = useCallback(() => draggingRef.current, [])
  const consumedDrag = useCallback(() => movedRef.current > DRAG_THRESHOLD, [])

  const reset = useCallback(() => {
    rotationRef.current = { yaw: 0, pitch: 0 }
    velRef.current = { yaw: 0, pitch: 0 }
    draggingRef.current = false
    armedRef.current = false
    activePointerIdRef.current = null
    movedRef.current = 0
  }, [])

  return useMemo(
    () => ({ attach, step, setAttachOptions, setHovered, isDragging, consumedDrag, reset }),
    [attach, step, setAttachOptions, setHovered, isDragging, consumedDrag, reset]
  )
}
