import { useCallback, useRef, useState } from "react";
import { imagesApi } from "@/api/images";
import type { DataPoolItem } from "@/types/image";

interface UseImageDragDropOptions {
  selectedKeys: Set<string>;
  onDropItemsOnFolder?: (
    imageIds: number[],
    folderPaths: string[],
    targetPath: string,
  ) => Promise<void>;
  dragSource?: string;
}

export function useImageDragDrop({
  selectedKeys,
  onDropItemsOnFolder,
  dragSource,
}: UseImageDragDropOptions) {
  const draggingKeyRef = useRef<string | null>(null);
  const [dragOverFolderKey, setDragOverFolderKey] = useState<string | null>(
    null,
  );

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
      ghost.textContent = `${dragKeys.length}개 항목`;
    } else if (item.type === "folder") {
      ghost.textContent = `📁 ${item.folder?.name || "폴더"}`;
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

  return {
    draggingKeyRef,
    dragOverFolderKey,
    handleDragStart,
    handleDragEnd,
    handleFolderDragOver,
    handleFolderDrop,
    handleFolderDragLeave,
  };
}
