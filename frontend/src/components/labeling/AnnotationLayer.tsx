import { Group, Rect, Text } from 'react-konva'
import type { Annotation } from '@/types/annotation'
import type { LabelClass } from '@/types/label-class'
import { normalizedBBoxToRect } from './coord-utils'

interface AnnotationLayerProps {
  annotations: Annotation[]
  labelClasses: LabelClass[]
  imageSize: { width: number; height: number }
  selectedAnnotationId: number | null
  onSelect: (id: number | null) => void
}

function getClassInfo(labelClasses: LabelClass[], classId: number | null) {
  if (classId == null) return { name: '미분류', color: '#888888' }
  const cls = labelClasses.find((c) => c.id === classId)
  return cls ? { name: cls.name, color: cls.color } : { name: '알 수 없음', color: '#888888' }
}

function ClassificationBadge({
  annotation,
  labelClasses,
  isSelected,
  index,
  onSelect,
}: {
  annotation: Annotation
  labelClasses: LabelClass[]
  isSelected: boolean
  index: number
  onSelect: (id: number | null) => void
}) {
  const { name, color } = getClassInfo(labelClasses, annotation.label_class_id)
  const y = 8 + index * 28

  return (
    <Group
      x={8}
      y={y}
      onClick={() => onSelect(isSelected ? null : annotation.id)}
      onTap={() => onSelect(isSelected ? null : annotation.id)}
    >
      <Rect
        width={name.length * 10 + 16}
        height={22}
        fill={color}
        cornerRadius={4}
        opacity={0.85}
        stroke={isSelected ? '#ffffff' : undefined}
        strokeWidth={isSelected ? 2 : 0}
      />
      <Text
        text={name}
        x={8}
        y={4}
        fontSize={12}
        fill="#ffffff"
        fontStyle={isSelected ? 'bold' : 'normal'}
      />
    </Group>
  )
}

function BBoxRect({
  annotation,
  labelClasses,
  imageSize,
  isSelected,
  onSelect,
}: {
  annotation: Annotation
  labelClasses: LabelClass[]
  imageSize: { width: number; height: number }
  isSelected: boolean
  onSelect: (id: number | null) => void
}) {
  const { name, color } = getClassInfo(labelClasses, annotation.label_class_id)
  const data = annotation.data as { x: number; y: number; width: number; height: number }
  const rect = normalizedBBoxToRect(
    { x: Number(data.x), y: Number(data.y), width: Number(data.width), height: Number(data.height) },
    imageSize,
  )

  return (
    <Group
      onClick={() => onSelect(isSelected ? null : annotation.id)}
      onTap={() => onSelect(isSelected ? null : annotation.id)}
    >
      <Rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        dash={isSelected ? [6, 3] : undefined}
        fill={isSelected ? `${color}20` : undefined}
      />
      <Rect
        x={rect.x}
        y={rect.y - 18}
        width={name.length * 8 + 12}
        height={18}
        fill={color}
        cornerRadius={[2, 2, 0, 0]}
      />
      <Text
        x={rect.x + 6}
        y={rect.y - 15}
        text={name}
        fontSize={11}
        fill="#ffffff"
      />
    </Group>
  )
}

export default function AnnotationLayer({
  annotations,
  labelClasses,
  imageSize,
  selectedAnnotationId,
  onSelect,
}: AnnotationLayerProps) {
  let classificationIndex = 0

  return (
    <>
      {annotations.map((ann) => {
        if (ann.annotation_type === 'classification') {
          const idx = classificationIndex++
          return (
            <ClassificationBadge
              key={ann.id}
              annotation={ann}
              labelClasses={labelClasses}
              isSelected={selectedAnnotationId === ann.id}
              index={idx}
              onSelect={onSelect}
            />
          )
        }

        if (ann.annotation_type === 'bbox') {
          return (
            <BBoxRect
              key={ann.id}
              annotation={ann}
              labelClasses={labelClasses}
              imageSize={imageSize}
              isSelected={selectedAnnotationId === ann.id}
              onSelect={onSelect}
            />
          )
        }

        return null
      })}
    </>
  )
}
