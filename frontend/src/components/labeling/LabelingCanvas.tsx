import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import { Loader2 } from "lucide-react";
import type { Annotation } from "@/types/annotation";
import type { LabelClass } from "@/types/label-class";
import { useCanvasTransform } from "@/hooks/use-canvas-transform";
import { useCursorManager } from "@/hooks/use-cursor-manager";
import { useLabelingStore } from "@/stores/labeling-store";
import AnnotationLayer from "./AnnotationLayer";
import ZoomControls from "./ZoomControls";
import BBoxDrawTool from "./tools/BBoxDrawTool";
import BBoxSelectTool from "./tools/BBoxSelectTool";

interface LabelingCanvasProps {
  imageUrl: string | null;
  annotations: Annotation[];
  labelClasses: LabelClass[];
  selectedAnnotationId: number | null;
  onSelectAnnotation: (id: number | null) => void;
  onScaleChange?: (scale: number) => void;
}

export default function LabelingCanvas({
  imageUrl,
  annotations,
  labelClasses,
  selectedAnnotationId,
  onSelectAnnotation,
  onScaleChange,
}: LabelingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [loadedImage, setLoadedImage] = useState<{
    url: string;
    img: HTMLImageElement;
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);

  // 이미지 URL이 변경되면 이전 이미지를 무효화 (effect 밖에서 파생)
  const image = loadedImage?.url === imageUrl ? loadedImage.img : null;
  // 로딩 상태도 파생: URL이 있고 아직 로드 완료 안 됨
  const imageLoading = !!imageUrl && !image && loadFailed !== imageUrl;

  const tool = useLabelingStore((s) => s.tool);
  const {
    stageRef,
    scale,
    isPanning,
    handleWheel,
    fitToScreen,
    resetTransform,
    zoomIn,
    zoomOut,
  } = useCanvasTransform(onScaleChange);
  const { setCursor, clearCursor, setToolCursor } = useCursorManager(stageRef);

  // 도구 변경 시 커서 업데이트
  useEffect(() => {
    setToolCursor(tool);
  }, [tool, setToolCursor]);

  // 팬 모드 커서 동기화
  useEffect(() => {
    if (isPanning) {
      setCursor("pan", "grab");
    } else {
      clearCursor("pan");
    }
  }, [isPanning, setCursor, clearCursor]);

  // ResizeObserver로 컨테이너 크기 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 이미지 로드 — setState는 콜백 내에서만 호출 (ESLint react-hooks/set-state-in-effect)
  useEffect(() => {
    if (!imageUrl) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      setLoadedImage({ url: imageUrl, img });
      setLoadFailed(null);
      fitToScreen(
        img.naturalWidth,
        img.naturalHeight,
        containerSize.width,
        containerSize.height,
      );
    };

    img.onerror = () => {
      setLoadFailed(imageUrl);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // 컨테이너 크기 변경 시 fit to screen 재계산
  const handleContainerResize = useCallback(() => {
    if (image) {
      fitToScreen(
        image.naturalWidth,
        image.naturalHeight,
        containerSize.width,
        containerSize.height,
      );
    }
  }, [image, containerSize.width, containerSize.height, fitToScreen]);

  useEffect(() => {
    handleContainerResize();
  }, [handleContainerResize]);

  const handleFitToScreen = useCallback(() => {
    if (image) {
      fitToScreen(
        image.naturalWidth,
        image.naturalHeight,
        containerSize.width,
        containerSize.height,
      );
    }
  }, [image, containerSize.width, containerSize.height, fitToScreen]);

  // 줌 단축키 (Ctrl+0, Ctrl+=, Ctrl+-)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      if (e.key === "0") {
        e.preventDefault();
        handleFitToScreen();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFitToScreen, zoomIn, zoomOut]);

  const imageSize = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: 0, height: 0 };

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
        <Layer>{image && <KonvaImage image={image} />}</Layer>

        {/* 어노테이션 레이어 -- select 도구가 아닐 때 기본 렌더링 */}
        {tool !== "select" && (
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
        {tool === "select" && image && (
          <Layer>
            <AnnotationLayer
              annotations={annotations.filter(
                (a) => a.annotation_type !== "bbox",
              )}
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
              onCursorChange={setCursor}
              onCursorClear={clearCursor}
            />
          </Layer>
        )}

        {/* bbox 그리기 도구 */}
        {tool === "bbox" && image && (
          <Layer>
            <BBoxDrawTool imageSize={imageSize} isPanning={isPanning} />
          </Layer>
        )}
      </Stage>

      {/* 줌 컨트롤 오버레이 */}
      <ZoomControls
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToScreen={handleFitToScreen}
        onResetZoom={resetTransform}
      />
    </div>
  );
}
