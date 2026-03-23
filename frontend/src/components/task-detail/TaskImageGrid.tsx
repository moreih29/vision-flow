import { useRef, useState, useEffect } from "react";
import { Images, LayoutGrid, List, Plus } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { ImageMeta } from "@/types/image";
import { TaskImageCard } from "./TaskImageCard";
import { TaskImageListView } from "./TaskImageListView";

interface TaskImageGridProps {
  images: ImageMeta[];
  loading: boolean;
  labelingProgress: number;
  imageCount: number;
  previewMode: "grid" | "list";
  onPreviewModeChange: (mode: "grid" | "list") => void;
  onAddImages: () => void;
  onRemoveImage: (imageId: number) => void;
}

export function TaskImageGrid({
  images,
  loading,
  labelingProgress,
  imageCount,
  previewMode,
  onPreviewModeChange,
  onAddImages,
  onRemoveImage,
}: TaskImageGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width >= 1024) setColumns(5);
      else if (width >= 768) setColumns(4);
      else if (width >= 640) setColumns(3);
      else setColumns(2);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(images.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220,
    overscan: 3,
  });

  return (
    <div className="min-w-0 flex-1 flex flex-col select-none">
      <div className="mb-4 flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">이미지</h2>
          {imageCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Progress value={labelingProgress} className="h-1.5 w-24" />
              <span>라벨링 {labelingProgress}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={previewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => onPreviewModeChange("grid")}
              title="격자 보기"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => onPreviewModeChange("list")}
              title="리스트 보기"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={onAddImages}>
            <Plus className="mr-2 h-4 w-4" />
            Pool에서 추가
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Images className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">이미지가 없습니다</p>
          <p className="text-sm text-muted-foreground">
            Data Pool에서 이미지를 추가하세요
          </p>
          <Button size="sm" onClick={onAddImages}>
            <Plus className="mr-2 h-4 w-4" />
            Pool에서 추가
          </Button>
        </div>
      ) : previewMode === "grid" ? (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * columns;
              const rowImages = images.slice(startIndex, startIndex + columns);
              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 right-0 flex gap-4"
                  style={{
                    top: `${virtualRow.start}px`,
                    height: `${virtualRow.size}px`,
                  }}
                >
                  {rowImages.map((image) => (
                    <div key={image.id} className="flex-1 min-w-0">
                      <TaskImageCard
                        image={image}
                        onRemove={() => onRemoveImage(image.id)}
                      />
                    </div>
                  ))}
                  {rowImages.length < columns &&
                    Array.from({ length: columns - rowImages.length }).map(
                      (_, i) => (
                        <div key={`empty-${i}`} className="flex-1 min-w-0" />
                      ),
                    )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <TaskImageListView images={images} onRemove={onRemoveImage} />
        </div>
      )}
    </div>
  );
}
