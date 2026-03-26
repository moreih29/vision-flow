import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Folder } from "lucide-react";

interface ImageItem {
  type: "image";
  id: number;
  filename: string;
  width?: number;
  height?: number;
  indexInFolder: number;
  totalInFolder: number;
}

interface FolderItem {
  type: "folder";
  name: string;
  folderCount: number;
  imageCount: number;
}

export type QuickLookItem = ImageItem | FolderItem;

interface ImageQuickLookProps {
  item: QuickLookItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getImageUrl: (imageId: number) => string;
}

export function ImageQuickLook({
  item,
  open,
  onOpenChange,
  getImageUrl,
}: ImageQuickLookProps) {
  // Space/Escape로 닫기: capture phase에서 잡아서 부모 handler까지 전파 차단
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onOpenChange(false);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onOpenChange]);

  if (!open || !item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center select-none cursor-default"
      onClick={() => onOpenChange(false)}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/80" />

      {/* 콘텐츠 */}
      <div
        className="relative flex flex-col rounded-xl overflow-hidden bg-black/90"
        style={{ width: "80vmin", height: "80vmin" }}
        onClick={(e) => e.stopPropagation()}
      >
        {item.type === "image" ? (
          <>
            {/* 이미지 영역 */}
            <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
              <img
                key={item.id}
                src={getImageUrl(item.id)}
                alt={item.filename}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </div>

            {/* 하단 정보 */}
            <div className="flex flex-col items-center gap-1 py-3 px-4 text-white/80 text-sm shrink-0">
              <span className="font-medium text-white truncate max-w-full">
                {item.filename}
              </span>
              <div className="flex items-center gap-3 text-white/60 text-xs">
                {item.width && item.height && (
                  <span>
                    {item.width} × {item.height}
                  </span>
                )}
                <span>
                  {item.indexInFolder + 1} / {item.totalInFolder}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 폴더 미리보기 영역 */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 overflow-hidden min-h-0">
              <Folder className="h-24 w-24 text-white/60" strokeWidth={1} />
              <span className="font-medium text-white text-lg truncate max-w-[80%]">
                {item.name}
              </span>
            </div>

            {/* 하단 정보 */}
            <div className="flex flex-col items-center gap-1 py-3 px-4 text-white/80 text-sm shrink-0">
              <div className="flex items-center gap-3 text-white/60 text-xs">
                {item.folderCount > 0 && <span>{item.folderCount}개 폴더</span>}
                <span>{item.imageCount}개 이미지</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
