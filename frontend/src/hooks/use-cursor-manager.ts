import { useCallback, useRef } from "react";
import type Konva from "konva";

/**
 * 커서 우선순위 레이어 (높을수록 우선)
 * pan > resize > hover > tool
 */
export type CursorLayer = "tool" | "hover" | "resize" | "pan";

const LAYER_PRIORITY: Record<CursorLayer, number> = {
  tool: 0,
  hover: 1,
  resize: 2,
  pan: 3,
};

/** 도구별 기본 커서 */
export const TOOL_CURSORS: Record<string, string> = {
  select: "default",
  bbox: "crosshair",
  classification: "pointer",
};

interface CursorManager {
  /** 특정 레이어에 커서 설정 */
  setCursor: (layer: CursorLayer, cursor: string) => void;
  /** 특정 레이어의 커서 해제 */
  clearCursor: (layer: CursorLayer) => void;
  /** 도구 변경 시 기본 커서 업데이트 */
  setToolCursor: (tool: string) => void;
}

export function useCursorManager(
  stageRef: React.RefObject<Konva.Stage | null>,
): CursorManager {
  const cursors = useRef<Partial<Record<CursorLayer, string>>>({
    tool: "default",
  });

  const applyHighestPriorityCursor = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let highestPriority = -1;
    let activeCursor = "default";

    for (const [layer, cursor] of Object.entries(cursors.current)) {
      const priority = LAYER_PRIORITY[layer as CursorLayer];
      if (priority > highestPriority) {
        highestPriority = priority;
        activeCursor = cursor!;
      }
    }

    stage.container().style.cursor = activeCursor;
  }, [stageRef]);

  const setCursor = useCallback(
    (layer: CursorLayer, cursor: string) => {
      cursors.current[layer] = cursor;
      applyHighestPriorityCursor();
    },
    [applyHighestPriorityCursor],
  );

  const clearCursor = useCallback(
    (layer: CursorLayer) => {
      delete cursors.current[layer];
      applyHighestPriorityCursor();
    },
    [applyHighestPriorityCursor],
  );

  const setToolCursor = useCallback(
    (tool: string) => {
      cursors.current.tool = TOOL_CURSORS[tool] ?? "default";
      applyHighestPriorityCursor();
    },
    [applyHighestPriorityCursor],
  );

  return { setCursor, clearCursor, setToolCursor };
}
