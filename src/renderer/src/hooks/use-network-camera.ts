import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  IDENTITY_ORIENTATION,
  mapScreenDragToArcball,
  quatFromAxisAngle,
  quatMultiply,
  type Orientation3D
} from '../utils/network-rotation'
import { debugNetworkDrag } from '../utils/graph-debug'

const DAMPING = 0.878
const MAX_ANGULAR_VEL = 0.062
const STOP_EPSILON = 0.0001
const ROT_SENSITIVITY = 1
/** Pixels of movement before a gesture counts as drag/rotation (not click). */
const DRAG_THRESHOLD = 5
/** Yaw speed when idle (radians per second) — ~0.09 rad/s ≈ 70s per revolution. */
const IDLE_YAW_RAD_PER_SEC = 0.09
const IDLE_RESUME_MS = 1600
const IDLE_START_DELAY_MS = 900

export type NetworkDragDirection = 'natural' | 'inverted'

export interface OrbitAttachOptions {
  onRotate?: (orientation: Orientation3D) => void
  onArm?: () => void
  onDragStart?: () => void
  onDragEnd?: (lastAngular: { ax: number; ay: number; az: number; angle: number }) => void
  /** Fired on pointerup when movement stayed below drag threshold (click/tap). */
  onTap?: (clientX: number, clientY: number) => void
  dragDirection?: NetworkDragDirection
}

export interface OrbitStep {
  orientation: Orientation3D
  moving: boolean
  lastAngular: { ax: number; ay: number; az: number; angle: number }
}

export function useNetworkOrbit(reduceMotion: boolean, idleAutoRotate = true) {
  const orientationRef = useRef<Orientation3D>({ ...IDENTITY_ORIENTATION })
  const angularVelRef = useRef({ ax: 0, ay: 0, az: 0, angle: 0 })
  const lastAngularRef = useRef({ ax: 0, ay: 0, az: 0, angle: 0 })

  const draggingRef = useRef(false)
  const armedRef = useRef(false)
  const didRotateRef = useRef(false)
  const lastPtrRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(0)
  const activePointerIdRef = useRef<number | null>(null)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const viewportRef = useRef<DOMRect | null>(null)
  const optionsRef = useRef<OrbitAttachOptions>({})
  const idleEnabledRef = useRef(idleAutoRotate && !reduceMotion)
  const idlePausedRef = useRef(true)
  const selectionPausedRef = useRef(false)
  const idleResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    idleEnabledRef.current = idleAutoRotate && !reduceMotion
    if (!idleEnabledRef.current) idlePausedRef.current = true
  }, [idleAutoRotate, reduceMotion])

  const clearIdleResumeTimer = useCallback(() => {
    if (idleResumeTimerRef.current) {
      clearTimeout(idleResumeTimerRef.current)
      idleResumeTimerRef.current = null
    }
  }, [])

  const scheduleIdleResume = useCallback(() => {
    idlePausedRef.current = true
    clearIdleResumeTimer()
    if (selectionPausedRef.current || !idleEnabledRef.current) return
    idleResumeTimerRef.current = setTimeout(() => {
      idleResumeTimerRef.current = null
      if (idleEnabledRef.current && !draggingRef.current && !selectionPausedRef.current) {
        idlePausedRef.current = false
      }
    }, IDLE_RESUME_MS)
  }, [clearIdleResumeTimer])

  const markInteraction = useCallback(() => {
    scheduleIdleResume()
  }, [scheduleIdleResume])

  const setSelectionPaused = useCallback(
    (paused: boolean) => {
      selectionPausedRef.current = paused
      if (paused) {
        idlePausedRef.current = true
        clearIdleResumeTimer()
        return
      }
      scheduleIdleResume()
    },
    [clearIdleResumeTimer, scheduleIdleResume]
  )

  const notifyLayoutReady = useCallback(() => {
    if (!idleEnabledRef.current || selectionPausedRef.current) return
    idlePausedRef.current = true
    clearIdleResumeTimer()
    idleResumeTimerRef.current = setTimeout(() => {
      idleResumeTimerRef.current = null
      if (idleEnabledRef.current && !draggingRef.current && !selectionPausedRef.current) {
        idlePausedRef.current = false
      }
    }, IDLE_START_DELAY_MS)
  }, [clearIdleResumeTimer])

  useEffect(() => {
    if (!idleAutoRotate || reduceMotion) {
      idlePausedRef.current = true
      return
    }
    notifyLayoutReady()
  }, [idleAutoRotate, reduceMotion, notifyLayoutReady])

  const setAttachOptions = useCallback((opts: OrbitAttachOptions) => {
    optionsRef.current = opts
  }, [])

  const emitRotate = useCallback((orientation: Orientation3D) => {
    optionsRef.current.onRotate?.(orientation)
  }, [])

  const releaseCapture = useCallback(() => {
    const target = captureTargetRef.current
    if (target?.hasPointerCapture(activePointerIdRef.current ?? -1)) {
      try {
        target.releasePointerCapture(activePointerIdRef.current!)
      } catch {
        /* already released */
      }
    }
    captureTargetRef.current = null
  }, [])

  const attach = useCallback(
    (root: HTMLElement | null) => {
      if (!root) return undefined

      const viewportRect = () => {
        viewportRef.current = root.getBoundingClientRect()
        return viewportRef.current
      }

      const pointerInViewport = (clientX: number, clientY: number) => {
        const rect = viewportRect()
        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        )
      }

      const clearWindowListeners = () => {
        window.removeEventListener('pointermove', onWindowPointerMove, true)
        window.removeEventListener('pointerup', onWindowPointerUp, true)
        window.removeEventListener('pointercancel', onWindowPointerUp, true)
      }

      const applyArcballDelta = (dx: number, dy: number) => {
        const rect = viewportRef.current ?? viewportRect()
        if (!rect.width || !rect.height) return
        const inverted = optionsRef.current.dragDirection === 'inverted'
        const deltaQ = mapScreenDragToArcball(dx, dy, rect, ROT_SENSITIVITY, inverted)
        orientationRef.current = quatMultiply(deltaQ, orientationRef.current)
        const ax = deltaQ.x
        const ay = deltaQ.y
        const az = deltaQ.z
        const angle = 2 * Math.acos(Math.min(1, Math.abs(deltaQ.w)))
        lastAngularRef.current = { ax, ay, az, angle }
        angularVelRef.current = {
          ax: Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, ax * angle * 8)),
          ay: Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, ay * angle * 8)),
          az: Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, az * angle * 8)),
          angle: Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, angle * 8))
        }
        didRotateRef.current = true
        emitRotate(orientationRef.current)
        debugNetworkDrag({ ax, ay, az, angle, dragging: true })
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

        applyArcballDelta(dx, dy)
      }

      const onWindowPointerMove = (e: PointerEvent) => onPointerMove(e)

      const finishGesture = () => {
        armedRef.current = false
        draggingRef.current = false
        activePointerIdRef.current = null
        releaseCapture()
        clearWindowListeners()
      }

      const onWindowPointerUp = (e: PointerEvent) => {
        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
          return
        }
        const tap = !didRotateRef.current && movedRef.current < DRAG_THRESHOLD
        const x = e.clientX
        const y = e.clientY
        finishGesture()
        if (tap) optionsRef.current.onTap?.(x, y)
      }

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return
        if (!pointerInViewport(e.clientX, e.clientY)) return

        didRotateRef.current = false
        movedRef.current = 0
        activePointerIdRef.current = e.pointerId
        angularVelRef.current = { ax: 0, ay: 0, az: 0, angle: 0 }
        lastAngularRef.current = { ax: 0, ay: 0, az: 0, angle: 0 }
        armedRef.current = true
        lastPtrRef.current = { x: e.clientX, y: e.clientY }
        viewportRect()

        optionsRef.current.onArm?.()
        scheduleIdleResume()

        try {
          root.setPointerCapture(e.pointerId)
          captureTargetRef.current = root
        } catch {
          /* window listeners still handle move */
        }

        clearWindowListeners()
        window.addEventListener('pointermove', onWindowPointerMove, true)
        window.addEventListener('pointerup', onWindowPointerUp, true)
        window.addEventListener('pointercancel', onWindowPointerUp, true)
      }

      root.addEventListener('pointerdown', onPointerDown, { capture: true })
      root.addEventListener('contextmenu', (ev) => ev.preventDefault())

      return () => {
        clearWindowListeners()
        releaseCapture()
        root.removeEventListener('pointerdown', onPointerDown, { capture: true })
      }
    },
    [emitRotate, releaseCapture, scheduleIdleResume]
  )

  const step = useCallback(
    (deltaSec = 1 / 60): OrbitStep => {
      if (draggingRef.current) {
        return {
          orientation: orientationRef.current,
          moving: true,
          lastAngular: lastAngularRef.current
        }
      }

      const av = angularVelRef.current
      const hasMomentum =
        !reduceMotion &&
        (Math.abs(av.ax) > STOP_EPSILON ||
          Math.abs(av.ay) > STOP_EPSILON ||
          Math.abs(av.az) > STOP_EPSILON ||
          Math.abs(av.angle) > STOP_EPSILON)

      if (hasMomentum) {
        const deltaQ = quatFromAxisAngle(av.ax, av.ay, av.az, av.angle)
        orientationRef.current = quatMultiply(deltaQ, orientationRef.current)
        emitRotate(orientationRef.current)
        av.ax *= DAMPING
        av.ay *= DAMPING
        av.az *= DAMPING
        av.angle *= DAMPING
        if (Math.abs(av.angle) < STOP_EPSILON) {
          av.ax = 0
          av.ay = 0
          av.az = 0
          av.angle = 0
        }
      } else if (av.ax !== 0 || av.ay !== 0 || av.az !== 0 || av.angle !== 0) {
        angularVelRef.current = { ax: 0, ay: 0, az: 0, angle: 0 }
        optionsRef.current.onDragEnd?.({ ...lastAngularRef.current })
      }

      let idleRotating = false
      const dt = Math.min(0.05, Math.max(0, deltaSec))
      if (
        idleEnabledRef.current &&
        !idlePausedRef.current &&
        !selectionPausedRef.current &&
        !hasMomentum &&
        dt > 0
      ) {
        const yaw = IDLE_YAW_RAD_PER_SEC * dt
        const deltaQ = quatFromAxisAngle(0, 1, 0, yaw)
        orientationRef.current = quatMultiply(deltaQ, orientationRef.current)
        emitRotate(orientationRef.current)
        idleRotating = true
      }

      const moving =
        draggingRef.current ||
        hasMomentum ||
        idleRotating ||
        Math.abs(av.ax) > STOP_EPSILON ||
        Math.abs(av.ay) > STOP_EPSILON ||
        Math.abs(av.az) > STOP_EPSILON ||
        Math.abs(av.angle) > STOP_EPSILON

      return {
        orientation: orientationRef.current,
        moving,
        lastAngular: lastAngularRef.current
      }
    },
    [reduceMotion, emitRotate]
  )

  const isDragging = useCallback(() => draggingRef.current, [])
  const consumedDrag = useCallback(() => {
    const consumed = didRotateRef.current
    didRotateRef.current = false
    return consumed
  }, [])

  const reset = useCallback(() => {
    orientationRef.current = { ...IDENTITY_ORIENTATION }
    angularVelRef.current = { ax: 0, ay: 0, az: 0, angle: 0 }
    lastAngularRef.current = { ax: 0, ay: 0, az: 0, angle: 0 }
    draggingRef.current = false
    armedRef.current = false
    didRotateRef.current = false
    activePointerIdRef.current = null
    movedRef.current = 0
    idlePausedRef.current = true
    clearIdleResumeTimer()
    releaseCapture()
    notifyLayoutReady()
  }, [releaseCapture, clearIdleResumeTimer, notifyLayoutReady])

  return useMemo(
    () => ({
      attach,
      step,
      setAttachOptions,
      isDragging,
      consumedDrag,
      reset,
      markInteraction,
      setSelectionPaused,
      notifyLayoutReady
    }),
    [
      attach,
      step,
      setAttachOptions,
      isDragging,
      consumedDrag,
      reset,
      markInteraction,
      setSelectionPaused,
      notifyLayoutReady
    ]
  )
}
