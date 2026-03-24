import { useEffect, useState } from "react";
import type { DataPoolItem } from "@/types/image";

interface UseImageContextMenuOptions {
  selectedKeys: Set<string>;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  onClearSelection: () => void;
}

export function useImageContextMenu({
  selectedKeys,
  onItemClick,
  onClearSelection,
}: UseImageContextMenuOptions) {
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);

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

  function handleContextMenu(item: DataPoolItem, index: number) {
    setBgMenu(null);
    if (!selectedKeys.has(item.key)) {
      onItemClick(index, {
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

  function closeBgMenu() {
    setBgMenu(null);
  }

  return {
    bgMenu,
    closeBgMenu,
    handleContextMenu,
    handleBgContextMenu,
    handleBgClick,
  };
}
