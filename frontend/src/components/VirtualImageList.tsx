import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpLeft,
  Check,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { imagesApi } from "@/api/images";
import type { DataPoolItem } from "@/types/image";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useImageDragDrop } from "@/hooks/use-image-drag-drop";
import { useImageContextMenu } from "@/hooks/use-image-context-menu";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface VirtualImageListProps {
  items: DataPoolItem[];
  selectedKeys: Set<string>;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  onNavigateFolder: (path: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDeleteImage: (id: number) => void;
  onDeleteFolder: (path: string) => void;
  onCheckboxClick: (index: number) => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onRenameFolder: (path: string) => void;
  onCreateFolderHere: () => void;
  renamingFolderPath: string | null;
  onFinishRenameFolder: (oldPath: string, newName: string) => void;
  onCancelRenameFolder: () => void;
  onClearSelection: () => void;
  onNavigateUp?: () => void;
  onDropItemsOnFolder?: (
    imageIds: number[],
    folderPaths: string[],
    targetPath: string,
  ) => Promise<void>;
  deleteLabel?: string;
  dragSource?: string;
}

export default function VirtualImageList({
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
  deleteLabel = "삭제",
  dragSource,
}: VirtualImageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = items.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (items[index]?.type === "parent" ? 0 : 52),
    overscan: 10,
  });

  useInfiniteScroll({
    virtualizer,
    rowCount,
    hasMore,
    loadingMore,
    onLoadMore,
  });

  const {
    dragOverFolderKey,
    handleDragStart,
    handleDragEnd,
    handleFolderDragOver,
    handleFolderDrop,
    handleFolderDragLeave,
  } = useImageDragDrop({ selectedKeys, onDropItemsOnFolder, dragSource });

  const {
    bgMenu,
    closeBgMenu,
    handleContextMenu,
    handleBgContextMenu,
    handleBgClick,
  } = useImageContextMenu({
    selectedKeys,
    onItemClick,
    onClearSelection,
  });

  const isMultiSelected = selectedKeys.size > 1;

  function renderContextMenuContent(item: DataPoolItem) {
    if (isMultiSelected && selectedKeys.has(item.key)) {
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onMoveSelected}>
            <FolderInput className="mr-2 h-3.5 w-3.5" />
            {selectedKeys.size}개 항목 이동...
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={onDeleteSelected}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {selectedKeys.size}개 항목 {deleteLabel}
          </ContextMenuItem>
        </ContextMenuContent>
      );
    }
    if (item.type === "folder" && item.folder) {
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => onNavigateFolder(item.folder!.path)}>
            <FolderOpen className="mr-2 h-3.5 w-3.5" />
            열기
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRenameFolder(item.folder!.path)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            이름 변경
          </ContextMenuItem>
          <ContextMenuItem onClick={onMoveSelected}>
            <FolderInput className="mr-2 h-3.5 w-3.5" />
            이동...
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDeleteFolder(item.folder!.path)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {deleteLabel}
          </ContextMenuItem>
        </ContextMenuContent>
      );
    }
    if (item.type === "image" && item.image) {
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onMoveSelected}>
            <FolderInput className="mr-2 h-3.5 w-3.5" />
            이동...
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDeleteImage(item.image!.id)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {deleteLabel}
          </ContextMenuItem>
        </ContextMenuContent>
      );
    }
    return null;
  }

  return (
    <>
      <div
        className="flex flex-col rounded-md border select-none"
        style={{ height: "100%" }}
      >
        {/* Header — 스크롤 밖 고정 */}
        <div className="shrink-0 bg-background">
          {/* 컬럼 헤더 */}
          <div className="flex border-b bg-muted/80 text-sm font-medium">
            <div className="w-10 shrink-0 px-3 py-2" />
            <div className="w-12 shrink-0 px-3 py-2" />
            <div className="flex-1 px-3 py-2">파일명</div>
            <div className="w-24 shrink-0 px-3 py-2">크기</div>
            <div className="w-28 shrink-0 px-3 py-2">해상도</div>
            <div className="w-16 shrink-0 px-3 py-2" />
          </div>
          {/* 상위 폴더 이동 */}
          {items.length > 0 && items[0].type === "parent" && (
            <div
              className="flex items-center border-b cursor-pointer hover:bg-muted/30"
              onClick={() => onNavigateUp?.()}
            >
              <div className="w-10 shrink-0" />
              <div className="w-12 shrink-0 px-3 py-1.5 flex items-center justify-center">
                <ArrowUpLeft className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                ..
              </div>
              <div className="w-24 shrink-0" />
              <div className="w-28 shrink-0" />
              <div className="w-16 shrink-0" />
            </div>
          )}
        </div>

        {/* 스크롤 영역 */}
        <div
          ref={parentRef}
          className="flex-1 min-h-0 overflow-y-auto"
          onContextMenu={handleBgContextMenu}
          onClick={handleBgClick}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index >= items.length;

              if (isLoaderRow) {
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center justify-center"
                  >
                    <span className="text-sm text-muted-foreground">
                      {loadingMore ? "로딩 중..." : ""}
                    </span>
                  </div>
                );
              }

              const item = items[virtualRow.index];
              const isSelected = selectedKeys.has(item.key);

              if (item.type === "parent") {
                // 상위 폴더는 sticky 헤더에 표시 — 가상 스크롤에서는 빈 공간
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  />
                );
              }

              if (item.type === "folder" && item.folder) {
                const isRenaming = renamingFolderPath === item.folder.path;
                const isFolderDropTarget = dragOverFolderKey === item.key;
                return (
                  <ContextMenu key={virtualRow.key}>
                    <ContextMenuTrigger>
                      <div
                        data-pool-item
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className={`flex items-center border-b last:border-0 cursor-pointer ${
                          isFolderDropTarget
                            ? "bg-primary/10 ring-2 ring-inset ring-primary"
                            : isSelected
                              ? "bg-primary/10"
                              : "hover:bg-muted/30"
                        }`}
                        onClick={(e) => onItemClick(virtualRow.index, e)}
                        onDoubleClick={() =>
                          onNavigateFolder(item.folder!.path)
                        }
                        onContextMenu={() =>
                          handleContextMenu(item, virtualRow.index)
                        }
                        draggable={!isRenaming}
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleFolderDragOver(e, item)}
                        onDragLeave={handleFolderDragLeave}
                        onDrop={(e) => handleFolderDrop(e, item)}
                      >
                        <div
                          className="w-10 shrink-0 flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckboxClick(virtualRow.index);
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
                                  const val = (
                                    e.target as HTMLInputElement
                                  ).value.trim();
                                  if (val)
                                    onFinishRenameFolder(
                                      item.folder!.path,
                                      val,
                                    );
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
                    {renderContextMenuContent(item)}
                  </ContextMenu>
                );
              }

              if (item.type === "image" && item.image) {
                const image = item.image;
                return (
                  <ContextMenu key={virtualRow.key}>
                    <ContextMenuTrigger>
                      <div
                        data-pool-item
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className={`flex items-center border-b last:border-0 cursor-pointer ${
                          isSelected ? "bg-primary/10" : "hover:bg-muted/30"
                        }`}
                        onClick={(e) => onItemClick(virtualRow.index, e)}
                        onContextMenu={() =>
                          handleContextMenu(item, virtualRow.index)
                        }
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={handleDragEnd}
                      >
                        <div
                          className="w-10 shrink-0 flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckboxClick(virtualRow.index);
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
                    {renderContextMenuContent(item)}
                  </ContextMenu>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>
      {bgMenu && (
        <div
          className="fixed z-50 w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: bgMenu.x, top: bgMenu.y }}
        >
          <button
            type="button"
            className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              closeBgMenu();
              onCreateFolderHere();
            }}
          >
            <FolderPlus className="h-3.5 w-3.5" />새 폴더
          </button>
        </div>
      )}
    </>
  );
}
