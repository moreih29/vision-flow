import { useCallback, useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface VirtualImageGridProps {
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
  variant?: "data-pool" | "task";
  dragSource?: string;
}

export default function VirtualImageGrid({
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
  variant = "data-pool",
  dragSource,
}: VirtualImageGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
  const draggingKeyRef = useRef<string | null>(null);
  const [dragOverFolderKey, setDragOverFolderKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const updateColumns = () => {
      const width = el.clientWidth;
      if (width >= 1280) setColumns(6);
      else if (width >= 1024) setColumns(5);
      else if (width >= 768) setColumns(4);
      else if (width >= 640) setColumns(3);
      else setColumns(2);
    };
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bgMenu) return;
    const handler = () => setBgMenu(null);
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handler);
    };
  }, [bgMenu]);

  const rowCount = Math.ceil(items.length / columns) + (hasMore ? 1 : 0);
  const itemSize = 200;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
    overscan: 3,
  });

  useEffect(() => {
    const vItems = virtualizer.getVirtualItems();
    if (vItems.length === 0) return;
    const lastItem = vItems[vItems.length - 1];
    if (lastItem && lastItem.index >= rowCount - 2 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [
    virtualizer.getVirtualItems(),
    rowCount,
    hasMore,
    loadingMore,
    onLoadMore,
  ]);

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleDragStart(e: React.DragEvent, item: DataPoolItem) {
    draggingKeyRef.current = item.key;
    const dragKeys = selectedKeys.has(item.key)
      ? [...selectedKeys]
      : [item.key];
    const imageIds = dragKeys
      .filter((k) => k.startsWith("i:"))
      .map((k) => parseInt(k.slice(2)));
    const folderPaths = dragKeys
      .filter((k) => k.startsWith("f:"))
      .map((k) => k.slice(2));
    e.dataTransfer.setData(
      "application/x-datapool-items",
      JSON.stringify({ imageIds, folderPaths, source: dragSource ?? "task" }),
    );
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.cssText =
      "position:fixed;top:-50px;left:0;z-index:99999;pointer-events:none;display:flex;align-items:center;gap:6px;padding:6px 10px;background:hsl(var(--popover));color:hsl(var(--popover-foreground));border:1px solid hsl(var(--border));border-radius:6px;font-size:13px;white-space:nowrap;max-width:240px;box-shadow:0 2px 8px rgba(0,0,0,.12);";
    if (dragKeys.length > 1) {
      ghost.textContent = `${dragKeys.length}\uAC1C \uD56D\uBAA9`;
    } else if (item.type === "folder") {
      ghost.textContent = `\uD83D\uDCC1 ${item.folder?.name || "\uD3F4\uB354"}`;
    } else if (item.type === "image" && item.image) {
      const thumb = document.createElement("img");
      thumb.src = imagesApi.getFileUrl(item.image.id);
      thumb.style.cssText =
        "width:28px;height:28px;object-fit:cover;border-radius:3px;flex-shrink:0;";
      const label = document.createElement("span");
      label.textContent = item.image.original_filename;
      label.style.cssText = "overflow:hidden;text-overflow:ellipsis;";
      ghost.appendChild(thumb);
      ghost.appendChild(label);
    }
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 100);
  }

  function handleDragEnd() {
    draggingKeyRef.current = null;
    setDragOverFolderKey(null);
  }

  const handleFolderDragOver = useCallback(
    (e: React.DragEvent, item: DataPoolItem) => {
      if (!onDropItemsOnFolder) return;
      if (!e.dataTransfer.types.includes("application/x-datapool-items"))
        return;
      const srcKey = draggingKeyRef.current;
      if (srcKey === item.key) return;
      if (srcKey && selectedKeys.has(srcKey) && selectedKeys.has(item.key))
        return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDragOverFolderKey(item.key);
    },
    [onDropItemsOnFolder, selectedKeys],
  );

  const handleFolderDrop = useCallback(
    (e: React.DragEvent, item: DataPoolItem) => {
      if (!onDropItemsOnFolder || !item.folder) return;
      const data = e.dataTransfer.getData("application/x-datapool-items");
      if (!data) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderKey(null);
      const { imageIds, folderPaths } = JSON.parse(data);
      const filteredFolders = folderPaths.filter(
        (p: string) => p !== item.folder!.path,
      );
      if (imageIds.length > 0 || filteredFolders.length > 0) {
        onDropItemsOnFolder(imageIds, filteredFolders, item.folder.path);
      }
    },
    [onDropItemsOnFolder],
  );

  function handleFolderDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderKey(null);
    }
  }

  function handleContextMenu(item: DataPoolItem, flatIndex: number) {
    setBgMenu(null);
    if (!selectedKeys.has(item.key)) {
      onItemClick(flatIndex, {
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      } as React.MouseEvent);
    }
  }

  function handleBgContextMenu(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-pool-item]")) return;
    e.preventDefault();
    setBgMenu({ x: e.clientX, y: e.clientY });
    onClearSelection();
  }

  function handleBgClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-pool-item]")) return;
    onClearSelection();
  }

  const isMultiSelected = selectedKeys.size > 1;

  const deleteLabel = variant === "task" ? "제거" : "삭제";

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
        ref={parentRef}
        className="overflow-y-auto rounded-md select-none"
        style={{ height: "100%" }}
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
            const startIndex = virtualRow.index * columns;
            const rowItems = items.slice(startIndex, startIndex + columns);
            const isLoaderRow =
              virtualRow.index >= Math.ceil(items.length / columns);

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
              >
                {isLoaderRow ? (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-sm text-muted-foreground">
                      {loadingMore ? "\uB85C\uB529 \uC911..." : ""}
                    </span>
                  </div>
                ) : (
                  <div
                    className="grid gap-3 pb-3"
                    style={{
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((item, colIdx) => {
                      const flatIndex = startIndex + colIdx;
                      const isSelected = selectedKeys.has(item.key);

                      if (item.type === "parent") {
                        return (
                          <div
                            key={item.key}
                            data-pool-item
                            className="group relative flex flex-col gap-1 cursor-pointer"
                            onClick={() => onNavigateUp?.()}
                          >
                            <div className="relative overflow-hidden rounded-md border bg-muted aspect-square flex flex-col items-center justify-center gap-2 transition-colors hover:bg-accent">
                              <ArrowUpLeft className="h-10 w-10 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">
                                상위 폴더
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (item.type === "folder" && item.folder) {
                        const isRenaming =
                          renamingFolderPath === item.folder.path;
                        const isFolderDropTarget =
                          dragOverFolderKey === item.key;
                        return (
                          <ContextMenu key={item.key}>
                            <ContextMenuTrigger>
                              <div
                                data-pool-item
                                className="group relative flex flex-col gap-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onItemClick(flatIndex, e);
                                }}
                                onDoubleClick={() =>
                                  onNavigateFolder(item.folder!.path)
                                }
                                onContextMenu={() =>
                                  handleContextMenu(item, flatIndex)
                                }
                                draggable={!isRenaming}
                                onDragStart={(e) => handleDragStart(e, item)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) =>
                                  handleFolderDragOver(e, item)
                                }
                                onDragLeave={handleFolderDragLeave}
                                onDrop={(e) => handleFolderDrop(e, item)}
                              >
                                <div
                                  className={`relative overflow-hidden rounded-md border bg-muted aspect-square flex flex-col items-center justify-center gap-2 transition-colors ${
                                    isFolderDropTarget
                                      ? "ring-2 ring-primary border-primary bg-primary/10"
                                      : isSelected
                                        ? "ring-2 ring-primary border-primary bg-primary/5"
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
                                    {isSelected && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </div>
                                  <Folder className="h-12 w-12 text-muted-foreground" />
                                  {isRenaming ? (
                                    <input
                                      autoFocus
                                      className="text-sm font-medium text-center max-w-[90%] bg-transparent border border-primary rounded px-1 outline-none"
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
                                        if (e.key === "Escape")
                                          onCancelRenameFolder();
                                      }}
                                      onBlur={(e) => {
                                        const val = e.target.value.trim();
                                        if (val && val !== item.folder!.name)
                                          onFinishRenameFolder(
                                            item.folder!.path,
                                            val,
                                          );
                                        else onCancelRenameFolder();
                                      }}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  ) : (
                                    <span className="text-sm font-medium truncate max-w-[90%]">
                                      {item.folder.name}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {item.folder.image_count}개 이미지
                                  </span>
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
                          <ContextMenu key={item.key}>
                            <ContextMenuTrigger>
                              <div
                                data-pool-item
                                className="group relative flex flex-col gap-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onItemClick(flatIndex, e);
                                }}
                                onContextMenu={() =>
                                  handleContextMenu(item, flatIndex)
                                }
                                draggable
                                onDragStart={(e) => handleDragStart(e, item)}
                                onDragEnd={handleDragEnd}
                              >
                                <div
                                  className={`relative overflow-hidden rounded-md border bg-muted aspect-square transition-colors ${
                                    isSelected
                                      ? "ring-2 ring-primary border-primary"
                                      : ""
                                  }`}
                                >
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
                                    {isSelected && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </div>
                                  <img
                                    src={imagesApi.getFileUrl(image.id)}
                                    alt={image.original_filename}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
                                </div>
                                <p
                                  className="truncate text-xs font-medium"
                                  title={image.original_filename}
                                >
                                  {image.original_filename}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatBytes(image.file_size)}
                                  {image.width && image.height
                                    ? ` \u00b7 ${image.width}\u00d7${image.height}`
                                    : ""}
                                </p>
                              </div>
                            </ContextMenuTrigger>
                            {renderContextMenuContent(item)}
                          </ContextMenu>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
              setBgMenu(null);
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
