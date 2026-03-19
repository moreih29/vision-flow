import { useCallback, useEffect, useRef } from 'react'
import { Rect, Text, Group, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { Annotation } from '@/types/annotation'
import type { LabelClass } from '@/types/label-class'
import { useLabelingStore } from '@/stores/labeling-store'
import { normalizedBBoxToRect, rectToNormalizedBBox } from '../coord-utils'

interface BBoxSelectToolProps {
  annotations: Annotation[]
  labelClasses: LabelClass[]
  imageSize: { width: number; height: number }
  isPanning: boolean
}

function getClassInfo(labelClasses: LabelClass[], classId: number | null) {
  if (classId == null) return { name: '미분류', color: '#888888' }
  const cls = labelClasses.find((c) => c.id === classId)
  return cls ? { name: cls.name, color: cls.color } : { name: '알 수 없음', color: '#888888' }
}

function SelectableBBox({
  annotation,
  labelClasses,
  imageSize,
  isSelected,
  isPanning,
  onSelect,
  rectRef,
}: {
  annotation: Annotation
  labelClasses: LabelClass[]
  imageSize: { width: number; height: number }
  isSelected: boolean
  isPanning: boolean
  onSelect: (id: number | null) => void
  rectRef?: (node: Konva.Rect | null) => void
}) {
  const updateAnnotation = useLabelingStore((s) => s.updateAnnotation)
  const { name, color } = getClassInfo(labelClasses, annotation.label_class_id)
  const data = annotation.data as { x: number; y: number; width: number; height: number }
  const rect = normalizedBBoxToRect(
    { x: Number(data.x), y: Number(data.y), width: Number(data.width), height: Number(data.height) },
    imageSize,
  )

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning) return
      e.cancelBubble = true
      onSelect(isSelected ? null : annotation.id)
    },
    [isPanning, isSelected, annotation.id, onSelect],
  )

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      const newX = node.x()
      const newY = node.y()
      const normalized = rectToNormalizedBBox(
        { x: newX, y: newY, width: rect.width, height: rect.height },
        imageSize,
      )
      updateAnnotation(annotation.id, {
        data: { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height },
      })
    },
    [annotation.id, rect.width, rect.height, imageSize, updateAnnotation],
  )

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Rect
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      // 스케일 적용 후 리셋
      node.scaleX(1)
      node.scaleY(1)
      const newWidth = Math.max(5, node.width() * scaleX)
      const newHeight = Math.max(5, node.height() * scaleY)
      const newX = node.x()
      const newY = node.y()
      node.width(newWidth)
      node.height(newHeight)
      const normalized = rectToNormalizedBBox(
        { x: newX, y: newY, width: newWidth, height: newHeight },
        imageSize,
      )
      updateAnnotation(annotation.id, {
        data: { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height },
      })
    },
    [annotation.id, imageSize, updateAnnotation],
  )

  return (
    <Group>
      <Rect
        ref={rectRef}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        fill={isSelected ? `${color}30` : `${color}10`}
        draggable={isSelected && !isPanning}
        onClick={handleClick}
        onTap={handleClick}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={(e) => {
          const stage = e.target.getStage()
          if (stage && !isPanning) stage.container().style.cursor = 'pointer'
        }}
        onMouseLeave={(e) => {
          const stage = e.target.getStage()
          if (stage && !isPanning) stage.container().style.cursor = 'default'
        }}
      />
      {/* 클래스명 라벨 */}
      <Rect
        x={rect.x}
        y={rect.y - 18}
        width={name.length * 8 + 12}
        height={18}
        fill={color}
        cornerRadius={[2, 2, 0, 0]}
        listening={false}
      />
      <Text
        x={rect.x + 6}
        y={rect.y - 15}
        text={name}
        fontSize={11}
        fill="#ffffff"
        listening={false}
      />
    </Group>
  )
}

export default function BBoxSelectTool({
  annotations,
  labelClasses,
  imageSize,
  isPanning,
}: BBoxSelectToolProps) {
  const selectedAnnotationId = useLabelingStore((s) => s.selectedAnnotationId)
  const setSelectedAnnotationId = useLabelingStore((s) => s.setSelectedAnnotationId)
  const removeAnnotation = useLabelingStore((s) => s.removeAnnotation)

  const trRef = useRef<Konva.Transformer>(null)
  const selectedRectRef = useRef<Konva.Rect | null>(null)

  const bboxAnnotations = annotations.filter((a) => a.annotation_type === 'bbox')

  // Transformer 연결
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    if (selectedAnnotationId != null && selectedRectRef.current) {
      tr.nodes([selectedRectRef.current])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
    }
  }, [selectedAnnotationId])

  // Delete/Backspace 키 삭제
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedAnnotationId == null) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // input/textarea에서는 무시
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        removeAnnotation(selectedAnnotationId)
        setSelectedAnnotationId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAnnotationId, removeAnnotation, setSelectedAnnotationId])

  // 빈 영역 클릭 시 선택 해제
  const handleBackgroundClick = useCallback(() => {
    if (!isPanning) {
      setSelectedAnnotationId(null)
    }
  }, [isPanning, setSelectedAnnotationId])

  return (
    <>
      {/* 빈 영역 클릭 감지용 투명 rect */}
      <Rect
        x={0}
        y={0}
        width={imageSize.width}
        height={imageSize.height}
        fill="transparent"
        onClick={handleBackgroundClick}
        onTap={handleBackgroundClick}
      />

      {bboxAnnotations.map((ann) => (
        <SelectableBBox
          key={ann.id}
          annotation={ann}
          labelClasses={labelClasses}
          imageSize={imageSize}
          isSelected={selectedAnnotationId === ann.id}
          isPanning={isPanning}
          onSelect={setSelectedAnnotationId}
          rectRef={selectedAnnotationId === ann.id ? (node) => { selectedRectRef.current = node } : undefined}
        />
      ))}

      {/* Transformer */}
      <Transformer
        ref={trRef}
        rotateEnabled={false}
        keepRatio={false}
        enabledAnchors={[
          'top-left', 'top-center', 'top-right',
          'middle-left', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right',
        ]}
        boundBoxFunc={(_oldBox, newBox) => {
          // 최소 크기 제한
          if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
            return _oldBox
          }
          return newBox
        }}
      />
    </>
  )
}
