import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import { Loader2 } from "lucide-react";
import type { Annotation } from "@/types/annotation";
import type { LabelClass } from "@/types/label-class";
import { useCanvasTransform } from "@/hooks/use-canvas-transform";
import { useCursorManager } from "@/hooks/use-cursor-manager";
import { useLabelingStore } from "@/stores/labeling-store";
import AnnotationLayer from "./AnnotationLayer";
import CanvasScrollbars from "./CanvasScrollbars";
import ZoomControls from "./ZoomControls";
import UnifiedBBoxTool from "./tools/UnifiedBBoxTool";

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
  const showAnnotations = useLabelingStore((s) => s.showAnnotations);
  const removeAnnotation = useLabelingStore((s) => s.removeAnnotation);
  const updateAnnotation = useLabelingStore((s) => s.updateAnnotation);

  const [contextMenu, setContextMenu] = useState<{
    annotationId: number;
    x: number;
    y: number;
    submenuOpen: boolean;
  } | null>(null);
  const {
    stageRef,
    scale,
    position,
    isPanning,
    handleWheel,
    fitToScreen,
    resetTransform,
    zoomIn,
    zoomOut,
  } = useCanvasTransform(
    onScaleChange,
    image
      ? { width: image.naturalWidth, height: image.naturalHeight }
      : undefined,
  );
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

  const handleBBoxContextMenu = useCallback(
    (annotationId: number, stageX: number, stageY: number) => {
      setContextMenu({
        annotationId,
        x: stageX,
        y: stageY,
        submenuOpen: false,
      });
    },
    [],
  );

  const handleDeleteFromMenu = useCallback(() => {
    if (!contextMenu) return;
    removeAnnotation(contextMenu.annotationId);
    setContextMenu(null);
  }, [contextMenu, removeAnnotation]);

  const handleChangeClass = useCallback(
    (classId: number) => {
      if (!contextMenu) return;
      updateAnnotation(contextMenu.annotationId, { label_class_id: classId });
      setContextMenu(null);
    },
    [contextMenu, updateAnnotation],
  );

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu) return;
    function handlePointerDown(e: PointerEvent) {
      const menu = document.getElementById("bbox-context-menu");
      if (menu && menu.contains(e.target as Node)) return;
      setContextMenu(null);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [contextMenu]);

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

  // 줌 단축키 (Ctrl+0, Ctrl+=, Ctrl+-) + F (Fit to Screen)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl) {
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
        return;
      }

      // F — Fit to Screen
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handleFitToScreen();
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
          <Loader2 className="h-8 w-8 animate-spin text-canvas-foreground/70" />
        </div>
      )}

      {loadFailed === imageUrl && imageUrl && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-canvas-foreground/70">
            이미지를 불러올 수 없습니다
          </p>
          <button
            className="rounded-md border border-canvas-foreground/20 px-3 py-1.5 text-xs text-canvas-foreground hover:bg-canvas-bg transition-colors"
            onClick={() => {
              setLoadFailed(null);
              setLoadedImage(null);
            }}
          >
            다시 시도
          </button>
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

        {/* bbox 도구: UnifiedBBoxTool이 bbox를 직접 렌더링 + 그리기/선택/이동/리사이즈 처리 */}
        {tool === "bbox" && image && (
          <Layer>
            {showAnnotations && (
              <AnnotationLayer
                annotations={annotations.filter(
                  (a) => a.annotation_type !== "bbox",
                )}
                labelClasses={labelClasses}
                imageSize={imageSize}
                selectedAnnotationId={selectedAnnotationId}
                onSelect={onSelectAnnotation}
              />
            )}
            <UnifiedBBoxTool
              annotations={showAnnotations ? annotations : []}
              labelClasses={labelClasses}
              imageSize={imageSize}
              isPanning={isPanning}
              onCursorChange={setCursor}
              onCursorClear={clearCursor}
              onBBoxContextMenu={handleBBoxContextMenu}
            />
          </Layer>
        )}

        {/* classification 도구: 기본 어노테이션 레이어만 렌더링 */}
        {tool === "classification" && showAnnotations && (
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
      </Stage>

      {/* 스크롤바 오버레이 */}
      {image && (
        <CanvasScrollbars
          position={position}
          scale={scale}
          imageSize={{ width: image.naturalWidth, height: image.naturalHeight }}
          containerSize={containerSize}
        />
      )}

      {/* 줌 컨트롤 오버레이 */}
      <ZoomControls
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToScreen={handleFitToScreen}
        onResetZoom={resetTransform}
      />

      {/* bbox 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          id="bbox-context-menu"
          className="absolute z-50 min-w-[160px] rounded-md border border bg-popover text-popover-foreground py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 클래스 변경 */}
          <div className="group relative">
            <button
              className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-canvas-foreground hover:bg-canvas-bg"
              onPointerEnter={() =>
                setContextMenu((prev) =>
                  prev ? { ...prev, submenuOpen: true } : prev,
                )
              }
            >
              <span>클래스 변경</span>
              <span className="ml-4 text-canvas-foreground/70">&#9658;</span>
            </button>
            {contextMenu.submenuOpen && (
              <div
                className="absolute left-full top-0 min-w-[160px] rounded-md border border bg-popover text-popover-foreground py-1 shadow-lg"
                onPointerLeave={() =>
                  setContextMenu((prev) =>
                    prev ? { ...prev, submenuOpen: false } : prev,
                  )
                }
              >
                {labelClasses.map((cls) => (
                  <button
                    key={cls.id}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-canvas-foreground hover:bg-canvas-bg"
                    onClick={() => handleChangeClass(cls.id)}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span className="truncate">{cls.name}</span>
                  </button>
                ))}
                {labelClasses.length === 0 && (
                  <span className="block px-3 py-1.5 text-sm text-canvas-foreground/50">
                    클래스 없음
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-canvas-foreground/20" />

          {/* 삭제 */}
          <button
            className="flex w-full items-center px-3 py-1.5 text-sm text-red-400 hover:bg-canvas-bg"
            onClick={handleDeleteFromMenu}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
