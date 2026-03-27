import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpLeft } from "lucide-react";
import { useImageContextMenu } from "@/hooks/use-image-context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { VirtualListProps, ViewerItem } from "./types";

export default function VirtualList<T extends ViewerItem>({
  items,
  selectedKeys,
  onItemClick,
  hasMore,
  loadingMore,
  onLoadMore,
  onClearSelection,
  renderItem,
  renderHeader,
  hasParentItem = false,
  onNavigateUp,
  renderBgMenu,
  totalCount,
  scrollToItemKey,
  onScrollComplete,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // totalCount가 있으면 전체 스크롤 길이를 미리 확보, 없으면 기존 방식 fallback
  const loadedCount = items.length;
  const effectiveTotalCount =
    totalCount !== undefined
      ? totalCount + (hasParentItem ? 1 : 0)
      : loadedCount;
  const rowCount =
    totalCount !== undefined
      ? effectiveTotalCount
      : loadedCount + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    // hasParentItem인 경우 첫 행(상위 폴더)은 sticky 헤더에 표시 — 높이 0
    estimateSize: (index) => (index === 0 && hasParentItem ? 0 : 52),
    overscan: 10,
  });

  // 폴더 이동 시 virtualizer 캐시 무효화 + 스크롤 리셋
  const firstItemKey = items[0]?.key;
  useEffect(() => {
    virtualizer.measure();
    parentRef.current?.scrollTo(0, 0);
  }, [firstItemKey, hasParentItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // scrollToItemKey 변경 시 해당 아이템 행으로 스크롤
  useEffect(() => {
    if (!scrollToItemKey) return;
    const idx = items.findIndex((item) => item.key === scrollToItemKey);
    if (idx < 0) return;
    virtualizer.scrollToIndex(idx, { align: "center" });
    onScrollComplete?.();
  }, [scrollToItemKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // viewport에 보이는 placeholder 행이 있으면 onLoadMore 호출
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (totalCount === undefined) {
      // 기존 방식: 마지막 행 근처에 도달하면 로드
      if (virtualItems.length === 0) return;
      const lastItem = virtualItems[virtualItems.length - 1];
      if (
        lastItem &&
        lastItem.index >= rowCount - 2 &&
        hasMore &&
        !loadingMore
      ) {
        onLoadMore();
      }
      return;
    }
    // totalCount 방식: placeholder 행이 viewport에 보이면 로드
    if (loadingMore) return;
    const hasVisiblePlaceholder = virtualItems.some(
      (vr) => vr.index >= loadedCount,
    );
    if (hasVisiblePlaceholder && hasMore) {
      onLoadMore();
    }
  }, [
    virtualItems,
    rowCount,
    loadedCount,
    hasMore,
    loadingMore,
    onLoadMore,
    totalCount,
  ]);

  const { bgMenu, closeBgMenu, handleBgContextMenu, handleBgClick } =
    useImageContextMenu({
      selectedKeys,
      onItemClick,
      onClearSelection,
    });

  return (
    <>
      <div
        className="flex flex-col rounded-md border select-none"
        style={{ height: "100%" }}
      >
        {/* 헤더 — 스크롤 밖 고정 */}
        <div className="shrink-0 bg-background">
          {renderHeader?.()}
          {/* 상위 폴더 이동 */}
          {hasParentItem && (
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
              // hasParentItem인 경우 첫 항목은 sticky 헤더에 표시 — 빈 공간
              if (virtualRow.index === 0 && hasParentItem) {
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

              // totalCount 방식: 로드된 범위 밖 행은 skeleton placeholder
              if (totalCount !== undefined && virtualRow.index >= loadedCount) {
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
                    className="flex items-center px-3 gap-3"
                  >
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-4 flex-1 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                  </div>
                );
              }

              // 기존 방식의 loader 행 (totalCount 없을 때)
              const isLoaderRow =
                totalCount === undefined && virtualRow.index >= items.length;

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
              return renderItem(item, virtualRow.index, isSelected, {
                size: virtualRow.size,
                start: virtualRow.start,
              });
            })}
          </div>
        </div>
      </div>
      {bgMenu && (
        <div
          className="fixed z-50 w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: bgMenu.x, top: bgMenu.y }}
        >
          {renderBgMenu?.(closeBgMenu)}
        </div>
      )}
    </>
  );
}
