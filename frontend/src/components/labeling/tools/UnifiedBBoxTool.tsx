import { useCallback, useEffect, useRef, useState } from "react";
import { Rect, Text, Group, Transformer } from "react-konva";
import type Konva from "konva";
import type { Annotation } from "@/types/annotation";
import type { LabelClass } from "@/types/label-class";
import { useLabelingStore } from "@/stores/labeling-store";
import {
  stageToImage,
  normalizedBBoxToRect,
  rectToNormalizedBBox,
} from "../coord-utils";
import type { CursorLayer } from "@/hooks/use-cursor-manager";

interface UnifiedBBoxToolProps {
  annotations: Annotation[];
  labelClasses: LabelClass[];
  imageSize: { width: number; height: number };
  isPanning: boolean;
  onCursorChange?: (layer: CursorLayer, cursor: string) => void;
  onCursorClear?: (layer: CursorLayer) => void;
  onBBoxContextMenu?: (
    annotationId: number,
    stageX: number,
    stageY: number,
  ) => void;
}

const MIN_BBOX_SIZE = 5;

let tempIdCounter = -1;

function getClassInfo(labelClasses: LabelClass[], classId: number | null) {
  if (classId == null) return { name: "미분류", color: "#888888" };
  const cls = labelClasses.find((c) => c.id === classId);
  return cls
    ? { name: cls.name, color: cls.color }
    : { name: "알 수 없음", color: "#888888" };
}

function SelectableBBox({
  annotation,
  labelClasses,
  imageSize,
  isSelected,
  isPanning,
  onSelect,
  rectRef,
  onCursorChange,
  onCursorClear,
  onContextMenu,
}: {
  annotation: Annotation;
  labelClasses: LabelClass[];
  imageSize: { width: number; height: number };
  isSelected: boolean;
  isPanning: boolean;
  onSelect: (id: number | null) => void;
  rectRef?: (node: Konva.Rect | null) => void;
  onCursorChange?: (layer: CursorLayer, cursor: string) => void;
  onCursorClear?: (layer: CursorLayer) => void;
  onContextMenu?: (
    annotationId: number,
    stageX: number,
    stageY: number,
  ) => void;
}) {
  const updateAnnotation = useLabelingStore((s) => s.updateAnnotation);
  const { name, color } = getClassInfo(labelClasses, annotation.label_class_id);
  const data = annotation.data as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const rect = normalizedBBoxToRect(
    {
      x: Number(data.x),
      y: Number(data.y),
      width: Number(data.width),
      height: Number(data.height),
    },
    imageSize,
  );

  const groupRef = useRef<Konva.Group>(null);
  const labelBgRef = useRef<Konva.Rect>(null);
  const labelTextRef = useRef<Konva.Text>(null);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning) return;
      e.cancelBubble = true;
      onSelect(isSelected ? null : annotation.id);
    },
    [isPanning, isSelected, annotation.id, onSelect],
  );

  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      onContextMenu?.(annotation.id, pointer.x, pointer.y);
    },
    [annotation.id, onContextMenu],
  );

  const handleGroupDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const group = e.target as Konva.Group;
      const offsetX = group.x();
      const offsetY = group.y();
      // Group position을 (0,0)으로 리셋하고 bbox 절대 좌표에 반영
      group.x(0);
      group.y(0);
      const newX = rect.x + offsetX;
      const newY = rect.y + offsetY;
      const normalized = rectToNormalizedBBox(
        { x: newX, y: newY, width: rect.width, height: rect.height },
        imageSize,
      );
      updateAnnotation(annotation.id, {
        data: {
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        },
      });
    },
    [
      annotation.id,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      imageSize,
      updateAnnotation,
    ],
  );

  const handleTransform = useCallback(() => {
    // 리사이즈 중 라벨 위치를 실시간으로 Rect의 현재 위치에 동기화
    const group = groupRef.current;
    if (!group) return;
    const bboxRect = group.findOne("Rect") as Konva.Rect | undefined;
    if (!bboxRect) return;
    const bboxX = bboxRect.x();
    const bboxY = bboxRect.y();
    labelBgRef.current?.y(bboxY - 18);
    labelBgRef.current?.x(bboxX);
    labelTextRef.current?.y(bboxY - 15);
    labelTextRef.current?.x(bboxX + 6);
  }, []);

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Rect;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const newWidth = Math.max(5, node.width() * scaleX);
      const newHeight = Math.max(5, node.height() * scaleY);
      const newX = node.x();
      const newY = node.y();
      node.width(newWidth);
      node.height(newHeight);
      // 라벨 위치 최종 동기화
      labelBgRef.current?.y(newY - 18);
      labelBgRef.current?.x(newX);
      labelTextRef.current?.y(newY - 15);
      labelTextRef.current?.x(newX + 6);
      const normalized = rectToNormalizedBBox(
        { x: newX, y: newY, width: newWidth, height: newHeight },
        imageSize,
      );
      updateAnnotation(annotation.id, {
        data: {
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        },
      });
    },
    [annotation.id, imageSize, updateAnnotation],
  );

  return (
    <Group
      ref={groupRef}
      draggable={!isPanning}
      onDragStart={() => {
        if (!isSelected) onSelect(annotation.id);
      }}
      onDragEnd={handleGroupDragEnd}
    >
      <Rect
        ref={rectRef}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        fill={isSelected ? `${color}30` : `${color}10`}
        shadowColor={color}
        shadowBlur={isSelected ? 12 : 0}
        shadowOpacity={0.5}
        onClick={handleClick}
        onTap={
          handleClick as unknown as (
            evt: Konva.KonvaEventObject<TouchEvent>,
          ) => void
        }
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={() => {
          if (!isPanning) onCursorChange?.("hover", "move");
        }}
        onMouseLeave={() => {
          onCursorClear?.("hover");
        }}
        onContextMenu={handleContextMenu}
      />
      {/* 클래스명 라벨 — Group 내 절대 좌표 (드래그 시 Group과 함께 이동) */}
      <Rect
        ref={labelBgRef}
        x={rect.x}
        y={rect.y - 18}
        width={name.length * 8 + 12}
        height={18}
        fill={color}
        cornerRadius={[2, 2, 0, 0]}
        listening={false}
      />
      <Text
        ref={labelTextRef}
        x={rect.x + 6}
        y={rect.y - 15}
        text={name}
        fontSize={11}
        fill="#ffffff"
        listening={false}
      />
    </Group>
  );
}

type DrawMode = "idle" | "click2preview";

export default function UnifiedBBoxTool({
  annotations,
  labelClasses,
  imageSize,
  isPanning,
  onCursorChange,
  onCursorClear,
  onBBoxContextMenu,
}: UnifiedBBoxToolProps) {
  const selectedClassId = useLabelingStore((s) => s.selectedClassId);
  const addAnnotation = useLabelingStore((s) => s.addAnnotation);
  const selectedAnnotationId = useLabelingStore((s) => s.selectedAnnotationId);
  const setSelectedAnnotationId = useLabelingStore(
    (s) => s.setSelectedAnnotationId,
  );
  const removeAnnotation = useLabelingStore((s) => s.removeAnnotation);

  const trRef = useRef<Konva.Transformer>(null);
  const selectedRectRef = useRef<Konva.Rect | null>(null);

  // 그리기 상태
  const [drawMode, setDrawMode] = useState<DrawMode>("idle");
  const click1PosRef = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const bboxAnnotations = annotations.filter(
    (a) => a.annotation_type === "bbox",
  );

  // Transformer 연결
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedAnnotationId != null && selectedRectRef.current) {
      tr.nodes([selectedRectRef.current]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedAnnotationId]);

  // Delete/Backspace + ESC 키 처리
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        // 클릭-클릭 모드 취소
        if (drawMode === "click2preview") {
          e.preventDefault();
          setDrawMode("idle");
          click1PosRef.current = null;
          setPreview(null);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedAnnotationId == null) return;
        e.preventDefault();
        removeAnnotation(selectedAnnotationId);
        setSelectedAnnotationId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedAnnotationId,
    removeAnnotation,
    setSelectedAnnotationId,
    drawMode,
  ]);

  function getImagePos(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const scale = stage.scaleX();
    const offset = stage.position();
    return stageToImage(pointer, scale, offset);
  }

  function createAnnotation(
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const normalized = rectToNormalizedBBox({ x, y, width, height }, imageSize);
    const now = new Date().toISOString();
    const newAnnotation: Annotation = {
      id: tempIdCounter--,
      task_image_id: 0,
      label_class_id: selectedClassId,
      annotation_type: "bbox",
      data: {
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
      },
      created_at: now,
      updated_at: now,
    };
    addAnnotation(newAnnotation);
    setSelectedAnnotationId(newAnnotation.id);
  }

  function handleBackgroundMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isPanning || e.evt.button !== 0) return;
    const pos = getImagePos(e);
    if (!pos) return;

    if (drawMode === "click2preview") {
      // 두 번째 클릭 — bbox 확정
      const start = click1PosRef.current!;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const width = Math.abs(pos.x - start.x);
      const height = Math.abs(pos.y - start.y);

      setDrawMode("idle");
      click1PosRef.current = null;
      setPreview(null);

      if (width < MIN_BBOX_SIZE || height < MIN_BBOX_SIZE) return;
      createAnnotation(x, y, width, height);
      return;
    }

    if (drawMode === "idle") {
      // 첫 번째 클릭 — 클릭-클릭 모드 시작
      click1PosRef.current = pos;
      setPreview(null);
      setDrawMode("click2preview");
      setSelectedAnnotationId(null);
    }
  }

  function handleBackgroundMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isPanning) return;
    const pos = getImagePos(e);
    if (!pos) return;

    if (drawMode === "click2preview" && click1PosRef.current) {
      // 클릭-클릭: 두 번째 클릭 전 러버밴드 프리뷰
      const start = click1PosRef.current;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const width = Math.abs(pos.x - start.x);
      const height = Math.abs(pos.y - start.y);
      setPreview({ x, y, width, height });
    }
  }

  function handleBackgroundMouseUp() {
    // 클릭-클릭 전용 — mouseup에서는 특별한 처리 없음
  }

  const handleBackgroundClick = useCallback(() => {
    // 드래그/클릭-클릭 처리 중이 아닌 idle 상태에서의 빈 영역 클릭은 선택 해제
    if (!isPanning && drawMode === "idle") {
      setSelectedAnnotationId(null);
    }
  }, [isPanning, drawMode, setSelectedAnnotationId]);

  const handleBackgroundContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
    },
    [],
  );

  return (
    <>
      {/* 배경 이벤트 캡처 rect */}
      <Rect
        x={0}
        y={0}
        width={imageSize.width}
        height={imageSize.height}
        fill="transparent"
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleBackgroundMouseMove}
        onMouseUp={handleBackgroundMouseUp}
        onClick={handleBackgroundClick}
        onTap={handleBackgroundClick}
        onContextMenu={handleBackgroundContextMenu}
      />

      {/* 기존 bbox 어노테이션 */}
      {bboxAnnotations.map((ann) => (
        <SelectableBBox
          key={ann.id}
          annotation={ann}
          labelClasses={labelClasses}
          imageSize={imageSize}
          isSelected={selectedAnnotationId === ann.id}
          isPanning={isPanning}
          onSelect={setSelectedAnnotationId}
          onCursorChange={onCursorChange}
          onCursorClear={onCursorClear}
          onContextMenu={onBBoxContextMenu}
          rectRef={
            selectedAnnotationId === ann.id
              ? (node) => {
                  selectedRectRef.current = node;
                }
              : undefined
          }
        />
      ))}

      {/* 드리기/클릭-클릭 프리뷰 */}
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

      {/* Transformer — 선택된 bbox 리사이즈 핸들 */}
      <Transformer
        ref={trRef}
        rotateEnabled={false}
        keepRatio={false}
        enabledAnchors={[
          "top-left",
          "top-center",
          "top-right",
          "middle-left",
          "middle-right",
          "bottom-left",
          "bottom-center",
          "bottom-right",
        ]}
        anchorSize={8}
        anchorCornerRadius={2}
        anchorStroke="#4f46e5"
        anchorFill="#ffffff"
        anchorStrokeWidth={1.5}
        borderStroke="#4f46e5"
        borderStrokeWidth={1.5}
        borderDash={[4, 4]}
        anchorStyleFunc={(anchor: Konva.Shape) => {
          const name = anchor.name();
          const cursorMap: Record<string, string> = {
            "top-left": "nwse-resize",
            "top-right": "nesw-resize",
            "bottom-left": "nesw-resize",
            "bottom-right": "nwse-resize",
            "top-center": "ns-resize",
            "bottom-center": "ns-resize",
            "middle-left": "ew-resize",
            "middle-right": "ew-resize",
          };
          anchor.on("mouseenter", () => {
            onCursorChange?.("resize", cursorMap[name] ?? "pointer");
          });
          anchor.on("mouseleave", () => {
            onCursorClear?.("resize");
          });
        }}
        boundBoxFunc={(_oldBox, newBox) => {
          if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
            return _oldBox;
          }
          return newBox;
        }}
      />
    </>
  );
}
