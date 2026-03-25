import { Check, Folder, Trash2 } from "lucide-react";
import { imagesApi } from "@/api/images";
import type { DataPoolItem } from "@/types/image";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import DataPoolContextMenu from "./DataPoolContextMenu";

interface ImageListRowProps {
  item: DataPoolItem;
  virtualRowIndex: number;
  virtualRowSize: number;
  virtualRowStart: number;
  isSelected: boolean;
  selectedKeys: Set<string>;
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

export default function ImageListRow({
  item,
  virtualRowIndex,
  virtualRowSize,
  virtualRowStart,
  isSelected,
  selectedKeys,
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
}: ImageListRowProps) {
  const rowStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: `${virtualRowSize}px`,
    transform: `translateY(${virtualRowStart}px)`,
  };

  const contextMenuProps = {
    item,
    selectedKeys,
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
      <ContextMenu key={`row-${virtualRowIndex}`}>
        <ContextMenuTrigger>
          <div
            data-pool-item
            style={rowStyle}
            className={`flex items-center border-b last:border-0 cursor-pointer ${
              isFolderDropTarget
                ? "bg-primary/10 ring-2 ring-inset ring-primary"
                : isSelected
                  ? "bg-primary/10"
                  : "hover:bg-muted/30"
            }`}
            onClick={(e) => onItemClick(virtualRowIndex, e)}
            onDoubleClick={() => onNavigateFolder(item.folder!.path)}
            onContextMenu={() => onContextMenu(item, virtualRowIndex)}
            draggable={!isRenaming}
            onDragStart={(e) => onDragStart(e, item)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onFolderDragOver(e, item)}
            onDragLeave={onFolderDragLeave}
            onDrop={(e) => onFolderDrop(e, item)}
          >
            <div
              className="w-10 shrink-0 flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onCheckboxClick(virtualRowIndex);
              }}
            >
              <div
                className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                }`}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
            </div>
            <div className="w-12 shrink-0 px-3 py-1.5 flex items-center justify-center">
              <Folder className="h-6 w-6 text-muted-foreground" />
            </div>
            <div
              className="flex-1 px-3 py-1.5 truncate text-sm font-medium"
              title={item.folder.name}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  className="w-full bg-transparent border border-primary rounded px-1 outline-none text-sm"
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
                item.folder.name
              )}
            </div>
            <div className="w-24 shrink-0 px-3 py-1.5 text-sm text-muted-foreground">
              {item.folder.image_count}개
            </div>
            <div className="w-28 shrink-0 px-3 py-1.5 text-sm text-muted-foreground">
              {item.folder.subfolder_count > 0
                ? `${item.folder.subfolder_count}개 하위폴더`
                : "-"}
            </div>
            <div className="w-16 shrink-0 px-3 py-1.5 text-right">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(item.folder!.path);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
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
      <ContextMenu key={`row-${virtualRowIndex}`}>
        <ContextMenuTrigger>
          <div
            data-pool-item
            style={rowStyle}
            className={`flex items-center border-b last:border-0 cursor-pointer ${
              isSelected ? "bg-primary/10" : "hover:bg-muted/30"
            }`}
            onClick={(e) => onItemClick(virtualRowIndex, e)}
            onDoubleClick={() => onImageDoubleClick?.(virtualRowIndex)}
            onContextMenu={() => onContextMenu(item, virtualRowIndex)}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onDragEnd={onDragEnd}
          >
            <div
              className="w-10 shrink-0 flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onCheckboxClick(virtualRowIndex);
              }}
            >
              <div
                className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                }`}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
            </div>
            <div className="w-12 shrink-0 px-3 py-1.5">
              <img
                src={imagesApi.getFileUrl(image.id)}
                alt={image.original_filename}
                className="h-10 w-10 rounded object-cover"
                loading="lazy"
              />
            </div>
            <div
              className="flex-1 px-3 py-1.5 truncate text-sm"
              title={image.original_filename}
            >
              {image.original_filename}
            </div>
            <div className="w-24 shrink-0 px-3 py-1.5 text-sm text-muted-foreground">
              {formatBytes(image.file_size)}
            </div>
            <div className="w-28 shrink-0 px-3 py-1.5 text-sm text-muted-foreground">
              {image.width && image.height
                ? `${image.width} x ${image.height}`
                : "-"}
            </div>
            <div className="w-16 shrink-0 px-3 py-1.5 text-right">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteImage(image.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </ContextMenuTrigger>
        <DataPoolContextMenu {...contextMenuProps} />
      </ContextMenu>
    );
  }

  return null;
}
