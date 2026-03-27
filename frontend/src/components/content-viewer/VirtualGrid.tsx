import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useImageContextMenu } from "@/hooks/use-image-context-menu";
import { ArrowUpLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { VirtualGridProps, ViewerItem } from "./types";

export default function VirtualGrid<T extends ViewerItem>({
  items,
  selectedKeys,
  onItemClick,
  hasMore,
  loadingMore,
  onLoadMore,
  onClearSelection,
  renderItem,
  hasParentItem = false,
  onNavigateUp,
  renderBgMenu,
  totalCount,
  scrollToItemKey,
  onScrollComplete,
  onColumnsChange,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      setContainerWidth(width);
      if (width >= 1280) setColumns(6);
      else if (width >= 1024) setColumns(5);
      else if (width >= 768) setColumns(4);
      else if (width >= 640) setColumns(3);
      else setColumns(2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onColumnsChange?.(columns);
  }, [columns, onColumnsChange]);

  // hasParentItem이 true이면 첫 번째 아이템은 상위 폴더 — 그리드에서 제외
  const gridItems = hasParentItem ? items.slice(1) : items;

  // totalCount가 있으면 전체 스크롤 길이를 미리 확보, 없으면 기존 방식 fallback
  const effectiveTotalCount =
    totalCount !== undefined ? totalCount : gridItems.length;
  const totalRowCount = Math.ceil(effectiveTotalCount / columns);
  const loadedRowCount = Math.ceil(gridItems.length / columns);
  // totalCount 없을 때는 기존처럼 hasMore면 loader 행 추가
  const rowCount =
    totalCount !== undefined
      ? totalRowCount
      : loadedRowCount + (hasMore ? 1 : 0);

  const gapSize = 16;
  const colWidth = Math.floor(
    (containerWidth - (columns - 1) * gapSize) / columns,
  );
  const itemSize = colWidth + 44;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
    overscan: 3,
  });

  // containerWidth 변경 시 virtualizer에 행 높이 재계산 요청
  useEffect(() => {
    virtualizer.measure();
  }, [itemSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // 폴더 이동 시 virtualizer 캐시 무효화 + 스크롤 리셋
  const firstItemKey = items[0]?.key;
  useEffect(() => {
    virtualizer.measure();
    parentRef.current?.scrollTo(0, 0);
  }, [firstItemKey, hasParentItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // scrollToItemKey 변경 시 해당 아이템 행으로 스크롤
  useEffect(() => {
    if (!scrollToItemKey) return;
    const idx = gridItems.findIndex((item) => item.key === scrollToItemKey);
    if (idx < 0) return;
    const rowIdx = Math.floor(idx / columns);
    virtualizer.scrollToIndex(rowIdx, { align: "center" });
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
      (vr) => vr.index >= loadedRowCount && vr.index < totalRowCount,
    );
    if (hasVisiblePlaceholder && hasMore) {
      onLoadMore();
    }
  }, [
    virtualItems,
    rowCount,
    loadedRowCount,
    totalRowCount,
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
        <div className="shrink-0">
          {hasParentItem && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md cursor-pointer transition-colors mb-1"
              onClick={() => onNavigateUp?.()}
            >
              <ArrowUpLeft className="h-4 w-4" />
              상위 폴더
            </div>
          )}
        </div>
        <div
          ref={parentRef}
          className="flex-1 min-h-0 overflow-y-auto rounded-md px-4"
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
              const rowItems = gridItems.slice(
                startIndex,
                startIndex + columns,
              );

              // totalCount 방식: 로드된 범위 밖 행은 skeleton placeholder
              if (
                totalCount !== undefined &&
                virtualRow.index >= loadedRowCount
              ) {
                // 마지막 행은 남은 아이템 수만큼만 skeleton 표시
                const isLastRow = virtualRow.index === totalRowCount - 1;
                const remainder = effectiveTotalCount % columns;
                const skeletonCount =
                  isLastRow && remainder > 0 ? remainder : columns;
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
                    <div
                      className="grid gap-4 pb-4"
                      style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: skeletonCount }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="w-full rounded-md"
                          style={{ height: `${itemSize - 16}px` }}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              // 기존 방식의 loader 행 (totalCount 없을 때)
              const isLoaderRow =
                totalCount === undefined &&
                virtualRow.index >= Math.ceil(gridItems.length / columns);

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
                        {loadingMore ? "로딩 중..." : ""}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="grid gap-4 pb-4"
                      style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      }}
                    >
                      {rowItems.map((item, colIdx) => {
                        const flatIndex =
                          startIndex + colIdx + (hasParentItem ? 1 : 0);
                        const isSelected = selectedKeys.has(item.key);
                        return renderItem(item, flatIndex, isSelected);
                      })}
                    </div>
                  )}
                </div>
              );
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
