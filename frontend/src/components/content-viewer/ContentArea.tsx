import { Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import VirtualGrid from "./VirtualGrid";
import VirtualList from "./VirtualList";
import type { ContentAreaProps, ViewerItem } from "./types";

export default function ContentArea<T extends ViewerItem>({
  items,
  contentsLoading = false,
  previewMode,
  selectedKeys,
  onItemClick,
  onClearSelection,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  renderGridItem,
  renderListItem,
  renderListHeader,
  hasParentItem = false,
  onNavigateUp,
  renderBgMenu,
  fileDrop,
  renderEmpty,
  totalCount,
}: ContentAreaProps<T>) {
  return (
    <div
      className={`min-w-0 flex-1 flex flex-col min-h-0 relative ${
        fileDrop?.isDragOver ? "ring-2 ring-primary ring-inset rounded-lg" : ""
      }`}
      onDragOver={fileDrop?.onDragOver}
      onDragLeave={fileDrop?.onDragLeave}
      onDrop={fileDrop?.onDrop}
    >
      {/* 업로드 드래그 오버레이 */}
      {fileDrop?.isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-primary/10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-10 w-10" />
            <p className="text-sm font-medium">
              {fileDrop.dropLabel ?? "파일 업로드"}
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
            renderEmpty ? (
              renderEmpty()
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  이 폴더에 항목이 없습니다.
                </p>
              </div>
            )
          ) : previewMode === "grid" ? (
            <VirtualGrid
              items={items}
              selectedKeys={selectedKeys}
              onItemClick={onItemClick}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={onLoadMore ?? (() => {})}
              onClearSelection={onClearSelection ?? (() => {})}
              hasParentItem={hasParentItem}
              onNavigateUp={onNavigateUp}
              renderBgMenu={renderBgMenu}
              renderItem={renderGridItem}
              totalCount={totalCount}
            />
          ) : (
            <VirtualList
              items={items}
              selectedKeys={selectedKeys}
              onItemClick={onItemClick}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={onLoadMore ?? (() => {})}
              onClearSelection={onClearSelection ?? (() => {})}
              hasParentItem={hasParentItem}
              onNavigateUp={onNavigateUp}
              renderBgMenu={renderBgMenu}
              renderHeader={renderListHeader}
              renderItem={renderListItem}
              totalCount={totalCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
