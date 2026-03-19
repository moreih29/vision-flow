import { useCallback, useEffect, useRef, useState } from 'react'
import type Konva from 'konva'

const SCALE_BY = 1.1
const MIN_SCALE = 0.1
const MAX_SCALE = 10

interface CanvasTransform {
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  position: { x: number; y: number }
  isPanning: boolean
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void
  fitToScreen: (imageWidth: number, imageHeight: number, containerWidth: number, containerHeight: number) => void
  resetTransform: () => void
}

export function useCanvasTransform(onScaleChange?: (scale: number) => void): CanvasTransform {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const spacePressed = useRef(false)

  const updateScale = useCallback(
    (newScale: number) => {
      setScale(newScale)
      onScaleChange?.(newScale)
    },
    [onScaleChange],
  )

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const direction = e.evt.deltaY > 0 ? -1 : 1
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY))

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      }

      stage.scale({ x: newScale, y: newScale })
      stage.position(newPos)
      stage.batchDraw()

      setPosition(newPos)
      updateScale(newScale)
    },
    [updateScale],
  )

  const fitToScreen = useCallback(
    (imageWidth: number, imageHeight: number, containerWidth: number, containerHeight: number) => {
      const stage = stageRef.current
      if (!stage) return

      const padding = 40
      const availableWidth = containerWidth - padding * 2
      const availableHeight = containerHeight - padding * 2

      const scaleX = availableWidth / imageWidth
      const scaleY = availableHeight / imageHeight
      const newScale = Math.min(scaleX, scaleY, 1)

      const newPos = {
        x: (containerWidth - imageWidth * newScale) / 2,
        y: (containerHeight - imageHeight * newScale) / 2,
      }

      stage.scale({ x: newScale, y: newScale })
      stage.position(newPos)
      stage.batchDraw()

      setPosition(newPos)
      updateScale(newScale)
    },
    [updateScale],
  )

  const resetTransform = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return

    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
    stage.batchDraw()

    setPosition({ x: 0, y: 0 })
    updateScale(1)
  }, [updateScale])

  // Space키 팬 핸들링
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !spacePressed.current && !e.repeat) {
        spacePressed.current = true
        setIsPanning(true)
        const stage = stageRef.current
        if (stage) {
          stage.draggable(true)
          stage.container().style.cursor = 'grab'
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spacePressed.current = false
        setIsPanning(false)
        const stage = stageRef.current
        if (stage) {
          stage.draggable(false)
          stage.container().style.cursor = 'default'
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // 드래그 중 커서 변경
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    function handleDragStart() {
      if (spacePressed.current) {
        stage!.container().style.cursor = 'grabbing'
      }
    }

    function handleDragEnd() {
      stage!.container().style.cursor = spacePressed.current ? 'grab' : 'default'
      const pos = stage!.position()
      setPosition(pos)
    }

    stage.on('dragstart', handleDragStart)
    stage.on('dragend', handleDragEnd)
    return () => {
      stage.off('dragstart', handleDragStart)
      stage.off('dragend', handleDragEnd)
    }
  }, [])

  return {
    stageRef,
    scale,
    position,
    isPanning,
    handleWheel,
    fitToScreen,
    resetTransform,
  }
}
