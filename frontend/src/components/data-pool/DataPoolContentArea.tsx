import { Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import VirtualImageGrid from "@/components/VirtualImageGrid";
import VirtualImageList from "@/components/VirtualImageList";
import type { DataPoolItem } from "@/types/image";

interface DataPoolContentAreaProps {
  items: DataPoolItem[];
  contentsLoading: boolean;
  previewMode: "grid" | "list";
  selectedKeys: Set<string>;
  hasMore: boolean;
  loadingMore: boolean;
  currentPath: string;
  renamingFolderPath: string | null;
  isDragOverUpload: boolean;
  onLoadMore: () => void;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  onNavigateFolder: (path: string) => void;
  onNavigateUp: (() => void) | undefined;
  onDeleteImage: (id: number) => void;
  onDeleteFolder: (path: string) => void;
  onCheckboxClick: (index: number) => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onRenameFolder: (path: string) => void;
  onCreateFolderHere: () => void;
  onFinishRenameFolder: (oldPath: string, newName: string) => void;
  onCancelRenameFolder: () => void;
  onClearSelection: () => void;
  onDropItemsOnFolder: (
    imageIds: number[],
    folderPaths: string[],
    targetPath: string,
  ) => Promise<void>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  deleteLabel?: string;
}

export default function DataPoolContentArea({
  items,
  contentsLoading,
  previewMode,
  selectedKeys,
  hasMore,
  loadingMore,
  currentPath,
  renamingFolderPath,
  isDragOverUpload,
  onLoadMore,
  onItemClick,
  onNavigateFolder,
  onNavigateUp,
  onDeleteImage,
  onDeleteFolder,
  onCheckboxClick,
  onMoveSelected,
  onDeleteSelected,
  onRenameFolder,
  onCreateFolderHere,
  onFinishRenameFolder,
  onCancelRenameFolder,
  onClearSelection,
  onDropItemsOnFolder,
  onDragOver,
  onDragLeave,
  onDrop,
  deleteLabel,
}: DataPoolContentAreaProps) {
  const sharedProps = {
    items,
    selectedKeys,
    onItemClick,
    onNavigateFolder,
    hasMore,
    loadingMore,
    onLoadMore,
    onDeleteImage,
    onDeleteFolder,
    onCheckboxClick,
    onMoveSelected,
    onDeleteSelected,
    onRenameFolder,
    onCreateFolderHere,
    renamingFolderPath,
    onFinishRenameFolder,
    onCancelRenameFolder,
    onClearSelection,
    onNavigateUp,
    onDropItemsOnFolder,
  };

  return (
    <div
      className={`min-w-0 flex-1 flex flex-col min-h-0 relative ${isDragOverUpload ? "ring-2 ring-primary ring-inset rounded-lg" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragOverUpload && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-primary/10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-10 w-10" />
            <p className="text-sm font-medium">
              {currentPath
                ? `"${currentPath.replace(/\/$/, "").split("/").pop()}" 폴더에 업로드`
                : "현재 위치에 파일 업로드"}
            </p>
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          {contentsLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                이 폴더에 항목이 없습니다.
              </p>
              <p className="text-xs text-muted-foreground">
                파일을 드래그하거나 상단 버튼으로 업로드하세요.
              </p>
            </div>
          ) : previewMode === "grid" ? (
            <VirtualImageGrid {...sharedProps} deleteLabel={deleteLabel} />
          ) : (
            <VirtualImageList {...sharedProps} deleteLabel={deleteLabel} />
          )}
        </div>
      </div>
    </div>
  );
}
