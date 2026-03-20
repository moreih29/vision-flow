import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";

const SCALE_BY = 1.05;
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

export function useCanvasTransform(
  onScaleChange?: (scale: number) => void,
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

  const updateScale = useCallback(
    (newScale: number) => {
      setScale(newScale);
      onScaleChange?.(newScale);
    },
    [onScaleChange],
  );

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

      const newPos = {
        x: cx - mousePointTo.x * newScale,
        y: cy - mousePointTo.y * newScale,
      };

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

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      applyZoom(direction as 1 | -1, pointer.x, pointer.y);
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
      const newPos = { x: pos.x + m.vx, y: pos.y + m.vy };
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
      const pos = stage!.position();
      setPosition(pos);

      // 팬 모드에서 드래그 종료 시 모멘텀 시작
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
