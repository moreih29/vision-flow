import { useRef, useState } from 'react'
import { Rect } from 'react-konva'
import type Konva from 'konva'
import { useLabelingStore } from '@/stores/labeling-store'
import { stageToImage, rectToNormalizedBBox } from '../coord-utils'
import type { Annotation } from '@/types/annotation'

interface BBoxDrawToolProps {
  imageSize: { width: number; height: number }
  isPanning: boolean
}

const MIN_BBOX_SIZE = 5

let tempIdCounter = -1

export default function BBoxDrawTool({ imageSize, isPanning }: BBoxDrawToolProps) {
  const selectedClassId = useLabelingStore((s) => s.selectedClassId)
  const addAnnotation = useLabelingStore((s) => s.addAnnotation)
  const setSelectedAnnotationId = useLabelingStore((s) => s.setSelectedAnnotationId)

  const [drawing, setDrawing] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [preview, setPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  function getImagePos(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage()
    if (!stage) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    const scale = stage.scaleX()
    const offset = stage.position()
    return stageToImage(pointer, scale, offset)
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isPanning || e.evt.button !== 0) return
    const pos = getImagePos(e)
    if (!pos) return
    startRef.current = pos
    setDrawing(true)
    setPreview(null)
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!drawing || !startRef.current || isPanning) return
    const pos = getImagePos(e)
    if (!pos) return
    const start = startRef.current
    const x = Math.min(start.x, pos.x)
    const y = Math.min(start.y, pos.y)
    const width = Math.abs(pos.x - start.x)
    const height = Math.abs(pos.y - start.y)
    setPreview({ x, y, width, height })
  }

  function handleMouseUp(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!drawing || !startRef.current || isPanning) {
      setDrawing(false)
      startRef.current = null
      setPreview(null)
      return
    }

    const pos = getImagePos(e)
    if (!pos) {
      setDrawing(false)
      startRef.current = null
      setPreview(null)
      return
    }

    const start = startRef.current
    const x = Math.min(start.x, pos.x)
    const y = Math.min(start.y, pos.y)
    const width = Math.abs(pos.x - start.x)
    const height = Math.abs(pos.y - start.y)

    setDrawing(false)
    startRef.current = null
    setPreview(null)

    // 최소 크기 체크 (이미지 좌표 기준 5x5)
    if (width < MIN_BBOX_SIZE || height < MIN_BBOX_SIZE) return

    const normalized = rectToNormalizedBBox({ x, y, width, height }, imageSize)
    const now = new Date().toISOString()
    const newAnnotation: Annotation = {
      id: tempIdCounter--,
      task_image_id: 0,
      label_class_id: selectedClassId,
      annotation_type: 'bbox',
      data: {
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
      },
      created_at: now,
      updated_at: now,
    }

    addAnnotation(newAnnotation)
    setSelectedAnnotationId(newAnnotation.id)
  }

  return (
    <>
      {/* 투명 Rect로 이벤트 캡처 */}
      <Rect
        x={0}
        y={0}
        width={imageSize.width}
        height={imageSize.height}
        fill="transparent"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* 프리뷰 rect */}
      {preview && (
        <Rect
          x={preview.x}
          y={preview.y}
          width={preview.width}
          height={preview.height}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 3]}
          fill="rgba(59, 130, 246, 0.1)"
          listening={false}
        />
      )}
    </>
  )
}
