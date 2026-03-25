import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageQuickLookProps {
  images: Array<{
    id: number;
    filename: string;
    width?: number;
    height?: number;
  }>;
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  getImageUrl: (imageId: number) => string;
}

export function ImageQuickLook({
  images,
  currentIndex,
  open,
  onOpenChange,
  onIndexChange,
  getImageUrl,
}: ImageQuickLookProps) {
  const current = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Space로 모달 닫기: capture phase에서 잡아서 부모 handler까지 전파 차단
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, stableOnOpenChange]);

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-none p-0 flex flex-col bg-black/90 border-0 overflow-hidden"
        style={{ width: "80vmin", height: "80vmin" }}
        showCloseButton={true}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "ArrowLeft" && hasPrev) {
            e.preventDefault();
            onIndexChange(currentIndex - 1);
          } else if (e.key === "ArrowRight" && hasNext) {
            e.preventDefault();
            onIndexChange(currentIndex + 1);
          }
        }}
      >
        {/* 이미지 영역 */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
          {/* 왼쪽 화살표 */}
          {hasPrev && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 z-10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => onIndexChange(currentIndex - 1)}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* 이미지 */}
          <img
            key={current.id}
            src={getImageUrl(current.id)}
            alt={current.filename}
            className="max-w-full max-h-full object-contain px-12"
          />

          {/* 오른쪽 화살표 */}
          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 z-10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => onIndexChange(currentIndex + 1)}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="flex flex-col items-center gap-1 py-3 px-4 text-white/80 text-sm select-none shrink-0">
          <span className="font-medium text-white truncate max-w-full">
            {current.filename}
          </span>
          <div className="flex items-center gap-3 text-white/60 text-xs">
            {current.width && current.height && (
              <span>
                {current.width} × {current.height}
              </span>
            )}
            <span>
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
