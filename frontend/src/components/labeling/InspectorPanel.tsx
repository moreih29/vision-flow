import { useLabelingStore } from "@/stores/labeling-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Annotation } from "@/types/annotation";
import type { LabelClass } from "@/types/label-class";
import type { TaskImageResponse } from "@/types/task-image";

interface InspectorPanelProps {
  selectedAnnotationId: number | null;
  annotations: Annotation[];
  labelClasses: LabelClass[];
  currentImage: TaskImageResponse | null;
  taskType?: string | null;
  imageSize?: { width: number; height: number };
}

const SINGLE_TOOL_TASK_TYPES = new Set(["classification", "object_detection"]);

export default function InspectorPanel({
  selectedAnnotationId,
  annotations,
  labelClasses,
  currentImage,
  taskType,
  imageSize,
}: InspectorPanelProps) {
  const updateAnnotation = useLabelingStore((s) => s.updateAnnotation);

  const selectedAnnotation =
    selectedAnnotationId != null
      ? (annotations.find((a) => a.id === selectedAnnotationId) ?? null)
      : null;

  if (selectedAnnotation) {
    const cls = labelClasses.find(
      (c) => c.id === selectedAnnotation.label_class_id,
    );
    const data = selectedAnnotation.data;
    const hasBbox =
      selectedAnnotation.annotation_type === "bbox" &&
      "x" in data &&
      "y" in data &&
      "width" in data &&
      "height" in data;

    const currentClassValue =
      selectedAnnotation.label_class_id != null
        ? String(selectedAnnotation.label_class_id)
        : "__none__";

    function handleClassChange(value: string) {
      if (selectedAnnotation == null) return;
      const newClassId = value === "__none__" ? null : Number(value);
      updateAnnotation(selectedAnnotation.id, { label_class_id: newClassId });
    }

    const iw = imageSize?.width;
    const ih = imageSize?.height;
    const hasPixels = iw != null && ih != null;

    return (
      <div className="space-y-2 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          어노테이션 속성
        </p>

        <div className="space-y-2 text-xs">
          {/* 클래스 — 라벨과 드롭다운 한 줄 */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-muted-foreground">클래스</span>
            <Select value={currentClassValue} onValueChange={handleClassChange}>
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue>
                  {cls ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: cls.color }}
                      />
                      <span>{cls.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">(미지정)</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">(미지정)</span>
                </SelectItem>
                {labelClasses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 타입 — 단일 도구 task에서는 숨김 */}
          {!(taskType != null && SINGLE_TOOL_TASK_TYPES.has(taskType)) && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>타입</span>
              <span className="font-mono">
                {selectedAnnotation.annotation_type}
              </span>
            </div>
          )}

          {/* bbox 위치/크기 */}
          {hasBbox && (
            <>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>위치</span>
                <span className="flex items-center gap-2 font-mono">
                  <span>
                    x:{" "}
                    {hasPixels
                      ? Math.round(Number(data.x) * iw!)
                      : Number(data.x).toFixed(3)}
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span>
                    y:{" "}
                    {hasPixels
                      ? Math.round(Number(data.y) * ih!)
                      : Number(data.y).toFixed(3)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>크기</span>
                <span className="font-mono">
                  {hasPixels
                    ? Math.round(Number(data.width) * iw!)
                    : Number(data.width).toFixed(3)}{" "}
                  ×{" "}
                  {hasPixels
                    ? Math.round(Number(data.height) * ih!)
                    : Number(data.height).toFixed(3)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">이미지 정보</p>
        <p className="mt-1 text-xs text-muted-foreground">이미지가 없습니다.</p>
      </div>
    );
  }

  const { image, folder_path } = currentImage;

  return (
    <div className="space-y-1.5 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">이미지 정보</p>

      <div className="space-y-1 text-xs">
        <div
          className="truncate text-foreground"
          title={image.original_filename}
        >
          {image.original_filename}
        </div>

        {image.width != null && image.height != null && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span>해상도</span>
            <span className="font-mono">
              {image.width} × {image.height}
            </span>
          </div>
        )}

        {folder_path && (
          <div className="flex items-start justify-between gap-2 text-muted-foreground">
            <span className="shrink-0">경로</span>
            <span className="truncate text-right font-mono" title={folder_path}>
              {folder_path}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
