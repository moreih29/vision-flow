import { useEffect } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

interface UseInfiniteScrollOptions {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rowCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function useInfiniteScroll({
  virtualizer,
  rowCount,
  hasMore,
  loadingMore,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem && lastItem.index >= rowCount - 2 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [virtualItems, rowCount, hasMore, loadingMore, onLoadMore]);
}
