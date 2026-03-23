import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";

export const SCALE_BY = 1.05;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const MOMENTUM_FRICTION = 0.92;
const MOMENTUM_MIN_VELOCITY = 0.5;

interface CanvasTransform {
  stageRef: React.RefObject<Konva.Stage | null>;
  scale: number;
  position: { x: number; y: number };
  isPanning: boolean;
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  fitToScreen: (
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
  ) => void;
  resetTransform: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

// 위치 클램핑 순수 함수 — 이미지가 뷰포트 50% 이상 벗어나지 않도록 제한
export function clampPosition(
  pos: { x: number; y: number },
  currentScale: number,
  containerWidth: number,
  containerHeight: number,
  imageSize?: { width: number; height: number },
): { x: number; y: number } {
  if (!imageSize) return pos;

  const scaledW = imageSize.width * currentScale;
  const scaledH = imageSize.height * currentScale;

  // 이미지가 컨테이너보다 작으면 중앙 정렬
  if (scaledW <= containerWidth && scaledH <= containerHeight) {
    return {
      x: (containerWidth - scaledW) / 2,
      y: (containerHeight - scaledH) / 2,
    };
  }

  // 50% 마진: 이미지가 뷰포트의 50%까지만 벗어날 수 있음
  const marginX = containerWidth * 0.5;
  const marginY = containerHeight * 0.5;

  const minX = containerWidth - scaledW - marginX;
  const maxX = marginX;
  const minY = containerHeight - scaledH - marginY;
  const maxY = marginY;

  return {
    x: Math.min(maxX, Math.max(minX, pos.x)),
    y: Math.min(maxY, Math.max(minY, pos.y)),
  };
}

export function useCanvasTransform(
  onScaleChange?: (scale: number) => void,
  imageSize?: { width: number; height: number },
): CanvasTransform {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const spacePressed = useRef(false);
  const middleMousePanning = useRef(false);
  const momentumRef = useRef<{ vx: number; vy: number; rafId: number | null }>({
    vx: 0,
    vy: 0,
    rafId: null,
  });
  const lastDragPos = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const imageSizeRef = useRef(imageSize);
  useEffect(() => {
    imageSizeRef.current = imageSize;
  }, [imageSize]);

  const updateScale = useCallback(
    (newScale: number) => {
      setScale(newScale);
      onScaleChange?.(newScale);
    },
    [onScaleChange],
  );

  // 훅 내부에서 클램핑 호출 시 imageSizeRef를 통해 최신 imageSize 반영
  function clampPositionWithRef(
    pos: { x: number; y: number },
    currentScale: number,
    containerWidth: number,
    containerHeight: number,
  ): { x: number; y: number } {
    return clampPosition(
      pos,
      currentScale,
      containerWidth,
      containerHeight,
      imageSizeRef.current,
    );
  }

  // 줌 적용 헬퍼 (포인터 중심 — 기존 구현 유지, 보간 세분화)
  const applyZoom = useCallback(
    (direction: 1 | -1, centerX?: number, centerY?: number) => {
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(
          MIN_SCALE,
          direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY,
        ),
      );

      // 줌 중심점 계산
      const cx = centerX ?? stage.width() / 2;
      const cy = centerY ?? stage.height() / 2;

      const mousePointTo = {
        x: (cx - stage.x()) / oldScale,
        y: (cy - stage.y()) / oldScale,
      };

      const rawPos = {
        x: cx - mousePointTo.x * newScale,
        y: cy - mousePointTo.y * newScale,
      };

      // 클램핑 적용
      const newPos = clampPositionWithRef(
        rawPos,
        newScale,
        stage.width(),
        stage.height(),
      );

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();

      setPosition(newPos);
      updateScale(newScale);
    },
    [updateScale],
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const isCtrl = e.evt.ctrlKey || e.evt.metaKey;

      if (isCtrl) {
        // Ctrl+휠: 줌인/줌아웃 (기존 동작)
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        applyZoom(direction as 1 | -1, pointer.x, pointer.y);
      } else {
        // 일반 휠: 팬
        const PAN_SPEED = 1;
        let dx = 0;
        let dy = 0;

        if (e.evt.shiftKey) {
          // Shift+휠: 수평 팬
          dx = -e.evt.deltaY * PAN_SPEED;
        } else {
          // 휠: 수직 팬, 수평 deltaX도 반영 (트랙패드 2축 지원)
          dx = -e.evt.deltaX * PAN_SPEED;
          dy = -e.evt.deltaY * PAN_SPEED;
        }

        const pos = stage.position();
        const newPos = clampPositionWithRef(
          { x: pos.x + dx, y: pos.y + dy },
          stage.scaleX(),
          stage.width(),
          stage.height(),
        );
        stage.position(newPos);
        stage.batchDraw();
        setPosition(newPos);
      }
    },
    [applyZoom],
  );

  const zoomIn = useCallback(() => applyZoom(1), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(-1), [applyZoom]);

  const fitToScreen = useCallback(
    (
      imageWidth: number,
      imageHeight: number,
      containerWidth: number,
      containerHeight: number,
    ) => {
      const stage = stageRef.current;
      if (!stage) return;

      const padding = 40;
      const availableWidth = containerWidth - padding * 2;
      const availableHeight = containerHeight - padding * 2;

      const scaleX = availableWidth / imageWidth;
      const scaleY = availableHeight / imageHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      const newPos = {
        x: (containerWidth - imageWidth * newScale) / 2,
        y: (containerHeight - imageHeight * newScale) / 2,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();

      setPosition(newPos);
      updateScale(newScale);
    },
    [updateScale],
  );

  const resetTransform = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();

    setPosition({ x: 0, y: 0 });
    updateScale(1);
  }, [updateScale]);

  // 모멘텀 애니메이션
  const startMomentum = useCallback(() => {
    const m = momentumRef.current;
    if (m.rafId != null) cancelAnimationFrame(m.rafId);

    function animate() {
      const stage = stageRef.current;
      if (!stage) return;

      m.vx *= MOMENTUM_FRICTION;
      m.vy *= MOMENTUM_FRICTION;

      if (
        Math.abs(m.vx) < MOMENTUM_MIN_VELOCITY &&
        Math.abs(m.vy) < MOMENTUM_MIN_VELOCITY
      ) {
        m.rafId = null;
        return;
      }

      const pos = stage.position();
      const rawPos = { x: pos.x + m.vx, y: pos.y + m.vy };
      const newPos = clampPositionWithRef(
        rawPos,
        stage.scaleX(),
        stage.width(),
        stage.height(),
      );
      // 클램핑에 걸리면 모멘텀 중단
      if (newPos.x !== rawPos.x) m.vx = 0;
      if (newPos.y !== rawPos.y) m.vy = 0;
      stage.position(newPos);
      stage.batchDraw();
      setPosition(newPos);

      m.rafId = requestAnimationFrame(animate);
    }

    m.rafId = requestAnimationFrame(animate);
  }, []);

  const stopMomentum = useCallback(() => {
    const m = momentumRef.current;
    if (m.rafId != null) {
      cancelAnimationFrame(m.rafId);
      m.rafId = null;
    }
    m.vx = 0;
    m.vy = 0;
  }, []);

  // 팬 모드 활성화/비활성화 헬퍼
  const enablePan = useCallback(() => {
    setIsPanning(true);
    const stage = stageRef.current;
    if (stage) {
      stage.draggable(true);
      stage.container().style.cursor = "grab";
    }
  }, []);

  const disablePan = useCallback(() => {
    setIsPanning(false);
    const stage = stageRef.current;
    if (stage) {
      stage.draggable(false);
      stage.container().style.cursor = "default";
    }
  }, []);

  // Space키 팬 핸들링
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !spacePressed.current && !e.repeat) {
        spacePressed.current = true;
        stopMomentum();
        enablePan();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spacePressed.current = false;
        if (!middleMousePanning.current) {
          disablePan();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enablePan, disablePan, stopMomentum]);

  // 미들 마우스 버튼 팬 핸들링
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const container = stage.container();

    function handleMouseDown(e: MouseEvent) {
      if (e.button === 1) {
        // 미들 마우스 버튼
        e.preventDefault();
        middleMousePanning.current = true;
        stopMomentum();
        enablePan();
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (e.button === 1 && middleMousePanning.current) {
        middleMousePanning.current = false;
        if (!spacePressed.current) {
          disablePan();
        }
      }
    }

    // 미들 클릭 기본 동작(자동 스크롤) 방지
    function handleAuxClick(e: MouseEvent) {
      if (e.button === 1) e.preventDefault();
    }

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("auxclick", handleAuxClick);
    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("auxclick", handleAuxClick);
    };
  }, [enablePan, disablePan, stopMomentum]);

  // 드래그 중 커서 변경 + 모멘텀 추적
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function handleDragStart() {
      if (spacePressed.current || middleMousePanning.current) {
        stage!.container().style.cursor = "grabbing";
        lastDragPos.current = { ...stage!.position(), time: performance.now() };
      }
    }

    function handleDragMove() {
      if (spacePressed.current || middleMousePanning.current) {
        const now = performance.now();
        const pos = stage!.position();
        const prev = lastDragPos.current;
        if (prev) {
          const dt = Math.max(1, now - prev.time);
          momentumRef.current.vx = ((pos.x - prev.x) / dt) * 16;
          momentumRef.current.vy = ((pos.y - prev.y) / dt) * 16;
        }
        lastDragPos.current = { ...pos, time: now };
      }
    }

    function handleDragEnd() {
      const isPanActive = spacePressed.current || middleMousePanning.current;
      stage!.container().style.cursor = isPanActive ? "grab" : "default";
      const rawPos = stage!.position();
      const clampedPos = clampPositionWithRef(
        rawPos,
        stage!.scaleX(),
        stage!.width(),
        stage!.height(),
      );
      stage!.position(clampedPos);
      stage!.batchDraw();
      setPosition(clampedPos);

      if (
        isPanActive &&
        (Math.abs(momentumRef.current.vx) > MOMENTUM_MIN_VELOCITY ||
          Math.abs(momentumRef.current.vy) > MOMENTUM_MIN_VELOCITY)
      ) {
        startMomentum();
      }
      lastDragPos.current = null;
    }

    stage.on("dragstart", handleDragStart);
    stage.on("dragmove", handleDragMove);
    stage.on("dragend", handleDragEnd);
    return () => {
      stage.off("dragstart", handleDragStart);
      stage.off("dragmove", handleDragMove);
      stage.off("dragend", handleDragEnd);
    };
  }, [startMomentum]);

  // cleanup
  useEffect(() => {
    return () => stopMomentum();
  }, [stopMomentum]);

  return {
    stageRef,
    scale,
    position,
    isPanning,
    handleWheel,
    fitToScreen,
    resetTransform,
    zoomIn,
    zoomOut,
  };
}
