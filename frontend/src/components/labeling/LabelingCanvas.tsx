import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import { Loader2 } from 'lucide-react'
import type { Annotation } from '@/types/annotation'
import type { LabelClass } from '@/types/label-class'
import { useCanvasTransform } from '@/hooks/use-canvas-transform'
import { useLabelingStore } from '@/stores/labeling-store'
import AnnotationLayer from './AnnotationLayer'
import BBoxDrawTool from './tools/BBoxDrawTool'
import BBoxSelectTool from './tools/BBoxSelectTool'

interface LabelingCanvasProps {
  imageUrl: string | null
  annotations: Annotation[]
  labelClasses: LabelClass[]
  selectedAnnotationId: number | null
  onSelectAnnotation: (id: number | null) => void
  onScaleChange?: (scale: number) => void
}

export default function LabelingCanvas({
  imageUrl,
  annotations,
  labelClasses,
  selectedAnnotationId,
  onSelectAnnotation,
  onScaleChange,
}: LabelingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  const tool = useLabelingStore((s) => s.tool)
  const { stageRef, isPanning, handleWheel, fitToScreen } = useCanvasTransform(onScaleChange)

  // ResizeObserver로 컨테이너 크기 감지
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setContainerSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // 이미지 로드
  useEffect(() => {
    if (!imageUrl) {
      setImage(null)
      return
    }

    setImageLoading(true)
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    img.onload = () => {
      setImage(img)
      setImageLoading(false)
      // 이미지 로드 후 fit to screen
      fitToScreen(img.naturalWidth, img.naturalHeight, containerSize.width, containerSize.height)
    }

    img.onerror = () => {
      setImage(null)
      setImageLoading(false)
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // 컨테이너 크기 변경 시 fit to screen 재계산
  const handleContainerResize = useCallback(() => {
    if (image) {
      fitToScreen(image.naturalWidth, image.naturalHeight, containerSize.width, containerSize.height)
    }
  }, [image, containerSize.width, containerSize.height, fitToScreen])

  useEffect(() => {
    handleContainerResize()
  }, [handleContainerResize])

  const imageSize = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: 0, height: 0 }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {imageLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      )}

      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        onWheel={handleWheel}
      >
        {/* 이미지 레이어 */}
        <Layer>
          {image && <KonvaImage image={image} />}
        </Layer>

        {/* 어노테이션 레이어 -- select 도구가 아닐 때 기본 렌더링 */}
        {tool !== 'select' && (
          <Layer>
            {image && (
              <AnnotationLayer
                annotations={annotations}
                labelClasses={labelClasses}
                imageSize={imageSize}
                selectedAnnotationId={selectedAnnotationId}
                onSelect={onSelectAnnotation}
              />
            )}
          </Layer>
        )}

        {/* select 도구: BBoxSelectTool이 bbox를 직접 렌더링 + 상호작용 */}
        {tool === 'select' && image && (
          <Layer>
            {/* classification 등 non-bbox 어노테이션은 AnnotationLayer로 렌더링 */}
            <AnnotationLayer
              annotations={annotations.filter((a) => a.annotation_type !== 'bbox')}
              labelClasses={labelClasses}
              imageSize={imageSize}
              selectedAnnotationId={selectedAnnotationId}
              onSelect={onSelectAnnotation}
            />
            <BBoxSelectTool
              annotations={annotations}
              labelClasses={labelClasses}
              imageSize={imageSize}
              isPanning={isPanning}
            />
          </Layer>
        )}

        {/* bbox 그리기 도구 */}
        {tool === 'bbox' && image && (
          <Layer>
            <BBoxDrawTool imageSize={imageSize} isPanning={isPanning} />
          </Layer>
        )}
      </Stage>
    </div>
  )
}
