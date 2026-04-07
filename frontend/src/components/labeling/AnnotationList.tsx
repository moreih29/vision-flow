import { useCallback, useRef } from "react";
import type { Annotation } from "@/types/annotation";
import type { LabelClass } from "@/types/label-class";
import { useLabelingStore } from "@/stores/labeling-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface AnnotationListProps {
  annotations: Annotation[];
  labelClasses: LabelClass[];
}

export default function AnnotationList({
  annotations,
  labelClasses,
}: AnnotationListProps) {
  const {
    selectedAnnotationId,
    selectedAnnotationIds,
    setSelectedAnnotationIds,
    toggleAnnotationSelection,
    updateAnnotation,
    removeAnnotations,
  } = useLabelingStore();

  // 마지막으로 단순 클릭된 항목의 인덱스 (Shift+클릭 범위 선택 기준점)
  const lastClickedIndexRef = useRef<number | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent, ann: Annotation, index: number) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+클릭: 토글
        toggleAnnotationSelection(ann.id);
        lastClickedIndexRef.current = index;
      } else if (e.shiftKey && lastClickedIndexRef.current != null) {
        // Shift+클릭: 범위 선택
        const from = Math.min(lastClickedIndexRef.current, index);
        const to = Math.max(lastClickedIndexRef.current, index);
        const rangeIds = new Set(
          annotations.slice(from, to + 1).map((a) => a.id),
        );
        setSelectedAnnotationIds(rangeIds);
      } else {
        // 단순 클릭: 단일 선택 (이미 단일 선택된 항목 클릭 시 해제)
        if (
          selectedAnnotationIds.size === 1 &&
          selectedAnnotationIds.has(ann.id)
        ) {
          setSelectedAnnotationIds(new Set());
        } else {
          setSelectedAnnotationIds(new Set([ann.id]));
        }
        lastClickedIndexRef.current = index;
      }
    },
    [
      annotations,
      selectedAnnotationIds,
      setSelectedAnnotationIds,
      toggleAnnotationSelection,
    ],
  );

  const handleChangeClass = useCallback(
    (classId: number, targetIds: Set<number>) => {
      for (const id of targetIds) {
        updateAnnotation(id, { label_class_id: classId });
      }
    },
    [updateAnnotation],
  );

  const handleDelete = useCallback(
    (targetIds: Set<number>) => {
      removeAnnotations([...targetIds]);
    },
    [removeAnnotations],
  );

  if (annotations.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        어노테이션 없음
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {annotations.map((ann, index) => {
        const cls = labelClasses.find((c) => c.id === ann.label_class_id);
        const isSelected =
          selectedAnnotationIds.size > 0
            ? selectedAnnotationIds.has(ann.id)
            : selectedAnnotationId === ann.id;

        // 우클릭 시 현재 항목이 선택 집합에 없으면 해당 항목만 선택
        const getContextIds = (): Set<number> => {
          if (
            selectedAnnotationIds.has(ann.id) &&
            selectedAnnotationIds.size > 0
          ) {
            return selectedAnnotationIds;
          }
          return new Set([ann.id]);
        };

        return (
          <ContextMenu key={ann.id}>
            <ContextMenuTrigger asChild>
              <button
                onClick={(e) => handleClick(e, ann, index)}
                onContextMenu={() => {
                  if (!selectedAnnotationIds.has(ann.id)) {
                    setSelectedAnnotationIds(new Set([ann.id]));
                    lastClickedIndexRef.current = index;
                  }
                }}
                className={`flex w-full items-center justify-between gap-1.5 rounded px-3 py-1.5 text-sm transition-colors text-left ${
                  isSelected
                    ? "bg-accent text-accent-foreground ring-1 ring-primary"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cls?.color ?? "#888" }}
                  />
                  <span className="truncate">{cls?.name ?? "(미지정)"}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  #{index + 1}
                </span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {(() => {
                const ids = getContextIds();
                const count = ids.size;
                const label = count > 1 ? `${count}개 항목` : null;
                return (
                  <>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        {label ? `${label}의 클래스 변경` : "클래스 변경"}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {labelClasses.map((lc) => (
                          <ContextMenuItem
                            key={lc.id}
                            onClick={() => handleChangeClass(lc.id, ids)}
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: lc.color }}
                            />
                            {lc.name}
                          </ContextMenuItem>
                        ))}
                        {labelClasses.length === 0 && (
                          <ContextMenuItem disabled>
                            클래스 없음
                          </ContextMenuItem>
                        )}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => handleDelete(ids)}
                    >
                      {label ? `${label} 삭제` : "삭제"}
                    </ContextMenuItem>
                  </>
                );
              })()}
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
