import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle } from "lucide-react";
import { useLabelingStore } from "@/stores/labeling-store";
import type { ImageMeta } from "@/types/image";

const TOKEN_KEY = "auth_token";

interface FilmStripProps {
  images: ImageMeta[];
  filteredIndices: number[];
}

export default function FilmStrip({ images, filteredIndices }: FilmStripProps) {
  const { currentImageIndex, setCurrentImageIndex, labeledImageIds } =
    useLabelingStore();

  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: filteredIndices.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72, // 60px 썸네일 + 패딩
    overscan: 5,
  });

  // 현재 이미지가 필터된 목록에서 몇 번째인지 찾기
  const currentFilteredPos = filteredIndices.indexOf(currentImageIndex);

  // 현재 이미지가 뷰포트 중앙에 오도록 스크롤
  useEffect(() => {
    if (currentFilteredPos < 0) return;
    virtualizer.scrollToIndex(currentFilteredPos, { align: "center" });
  }, [currentFilteredPos, virtualizer]);

  const token = localStorage.getItem(TOKEN_KEY) ?? "";

  function getThumbUrl(imageId: number) {
    return `/api/v1/images/${imageId}/file?token=${token}`;
  }

  return (
    <div
      className="flex h-20 shrink-0 border-t bg-neutral-900 select-none"
      style={{ minHeight: 80 }}
    >
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "thin" }}
      >
        <div
          style={{
            width: `${virtualizer.getTotalSize()}px`,
            height: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const realIndex = filteredIndices[virtualItem.index];
            const image = images[realIndex];
            if (!image) return null;
            const isActive = realIndex === currentImageIndex;
            const isLabeled = labeledImageIds.has(image.id);

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: virtualItem.start,
                  width: virtualItem.size,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 4px",
                }}
              >
                <button
                  className="relative shrink-0 cursor-pointer overflow-hidden rounded"
                  style={{
                    width: 60,
                    height: 60,
                    outline: isActive
                      ? "2px solid hsl(var(--primary))"
                      : "2px solid transparent",
                    outlineOffset: 1,
                  }}
                  onClick={() => setCurrentImageIndex(realIndex)}
                  title={image.original_filename}
                >
                  <img
                    src={getThumbUrl(image.id)}
                    alt={image.original_filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  {/* 라벨링 완료 표시 */}
                  {isLabeled && (
                    <div className="absolute bottom-0.5 right-0.5">
                      <CheckCircle className="h-3.5 w-3.5 text-green-400 drop-shadow" />
                    </div>
                  )}
                  {/* 미라벨 오버레이 — 현재 이미지가 아닐 때 살짝 어둡게 */}
                  {!isActive && !isLabeled && (
                    <div className="absolute inset-0 bg-black/30" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
