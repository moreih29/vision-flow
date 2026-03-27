import { memo } from "react";
import { Check, Folder, Trash2 } from "lucide-react";
import { imagesApi } from "@/api/images";
import type { DataPoolItem } from "@/types/image";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import DataPoolContextMenu from "./DataPoolContextMenu";

interface ImageGridCardProps {
  item: DataPoolItem;
  flatIndex: number;
  isSelected: boolean;
  selectedCount: number;
  renamingFolderPath: string | null;
  dragOverFolderKey: string | null;
  deleteLabel?: string;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  onCheckboxClick: (index: number) => void;
  onNavigateFolder: (path: string) => void;
  onRenameFolder: (path: string) => void;
  onFinishRenameFolder: (oldPath: string, newName: string) => void;
  onCancelRenameFolder: () => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onDeleteFolder: (path: string) => void;
  onDeleteImage: (id: number) => void;
  onImageDoubleClick?: (index: number) => void;
  onContextMenu: (item: DataPoolItem, index: number) => void;
  onDragStart: (e: React.DragEvent, item: DataPoolItem) => void;
  onDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, item: DataPoolItem) => void;
  onFolderDragLeave: (e: React.DragEvent) => void;
  onFolderDrop: (e: React.DragEvent, item: DataPoolItem) => void;
}

const ImageGridCard = memo(function ImageGridCard({
  item,
  flatIndex,
  isSelected,
  selectedCount,
  renamingFolderPath,
  dragOverFolderKey,
  deleteLabel = "삭제",
  onItemClick,
  onCheckboxClick,
  onNavigateFolder,
  onRenameFolder,
  onFinishRenameFolder,
  onCancelRenameFolder,
  onMoveSelected,
  onDeleteSelected,
  onDeleteFolder,
  onDeleteImage,
  onImageDoubleClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
}: ImageGridCardProps) {
  const contextMenuProps = {
    item,
    selectedCount,
    isSelected,
    deleteLabel,
    onNavigateFolder,
    onRenameFolder,
    onMoveSelected,
    onDeleteSelected,
    onDeleteFolder,
    onDeleteImage,
  };

  if (item.type === "folder" && item.folder) {
    const isRenaming = renamingFolderPath === item.folder.path;
    const isFolderDropTarget = dragOverFolderKey === item.key;

    return (
      <ContextMenu key={item.key}>
        <ContextMenuTrigger>
          <div
            data-pool-item
            className="group relative cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(flatIndex, e);
            }}
            onDoubleClick={() => onNavigateFolder(item.folder!.path)}
            onContextMenu={() => onContextMenu(item, flatIndex)}
            draggable={!isRenaming}
            onDragStart={(e) => onDragStart(e, item)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onFolderDragOver(e, item)}
            onDragLeave={onFolderDragLeave}
            onDrop={(e) => onFolderDrop(e, item)}
          >
            <div
              className={`overflow-hidden rounded-lg border shadow-sm transition-colors ${
                isFolderDropTarget
                  ? "ring-2 ring-primary border-primary"
                  : isSelected
                    ? "ring-2 ring-primary border-primary"
                    : "hover:shadow-md"
              }`}
            >
              <div
                className={`relative aspect-square bg-muted flex flex-col items-center justify-center gap-2 transition-colors ${
                  isFolderDropTarget
                    ? "bg-primary/10"
                    : isSelected
                      ? "bg-primary/5"
                      : "hover:bg-accent"
                }`}
              >
                <div
                  className={`absolute left-1.5 top-1.5 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-opacity cursor-pointer ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground opacity-100"
                      : "border-muted-foreground/40 bg-background/60 opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckboxClick(flatIndex);
                  }}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <Folder className="h-24 w-24 text-muted-foreground" />
                {isRenaming ? (
                  <input
                    autoFocus
                    className="text-sm font-medium text-center max-w-[90%] bg-transparent border border-primary rounded px-1 outline-none"
                    defaultValue={item.folder.name}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) onFinishRenameFolder(item.folder!.path, val);
                        else onCancelRenameFolder();
                      }
                      if (e.key === "Escape") onCancelRenameFolder();
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== item.folder!.name)
                        onFinishRenameFolder(item.folder!.path, val);
                      else onCancelRenameFolder();
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                ) : (
                  <span
                    className="text-sm font-medium truncate max-w-[90%]"
                    title={item.folder.name}
                  >
                    {item.folder.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {item.folder.image_count}개 이미지
                </span>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <DataPoolContextMenu {...contextMenuProps} />
      </ContextMenu>
    );
  }

  if (item.type === "image" && item.image) {
    const image = item.image;
    return (
      <ContextMenu key={item.key}>
        <ContextMenuTrigger>
          <div
            data-pool-item
            className="group relative cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(flatIndex, e);
            }}
            onDoubleClick={() => onImageDoubleClick?.(flatIndex)}
            onContextMenu={() => onContextMenu(item, flatIndex)}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onDragEnd={onDragEnd}
          >
            <div
              className={`overflow-hidden rounded-lg border shadow-sm transition-colors ${
                isSelected
                  ? "ring-2 ring-primary border-primary"
                  : "hover:shadow-md"
              }`}
            >
              <div className="relative aspect-square bg-muted overflow-hidden">
                <div
                  className={`absolute left-1.5 top-1.5 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-opacity cursor-pointer ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground opacity-100"
                      : "border-white/70 bg-black/20 opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckboxClick(flatIndex);
                  }}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <img
                  src={imagesApi.getThumbnailUrl(image.id)}
                  alt={image.original_filename}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteImage(image.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white/90">
                    {formatBytes(image.file_size)}
                    {image.width && image.height
                      ? ` · ${image.width}×${image.height}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="px-2 py-1.5 bg-background">
                <p
                  className="truncate text-xs font-medium"
                  title={image.original_filename}
                >
                  {image.original_filename}
                </p>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <DataPoolContextMenu {...contextMenuProps} />
      </ContextMenu>
    );
  }

  return null;
});

export default ImageGridCard;
