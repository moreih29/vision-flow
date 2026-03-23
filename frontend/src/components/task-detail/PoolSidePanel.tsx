import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dataStoresApi } from "@/api/data-stores";
import { imagesApi } from "@/api/images";
import { tasksApi } from "@/api/tasks";
import { FolderTreeView } from "@/components/folder-tree/FolderTreeView";
import type { FolderTreeRef } from "@/components/folder-tree/FolderTreeView";
import type { DataStore } from "@/types/data-store";
import type { ImageMeta } from "@/types/image";

export interface PoolSidePanelProps {
  open: boolean;
  projectId: number;
  taskId: number;
  targetFolderPath: string;
  onImagesAdded: () => void;
  onClose: () => void;
}

export function PoolSidePanel({
  open,
  projectId,
  taskId,
  targetFolderPath,
  onImagesAdded,
  onClose,
}: PoolSidePanelProps) {
  const treeRef = useRef<FolderTreeRef>(null);
  const [dataStore, setDataStore] = useState<DataStore | null>(null);
  const [dsLoading, setDsLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  // DataStore 초기화
  useEffect(() => {
    if (!open) return;
    setSelectedPath("");
    setSelectedIds(new Set());
    setImages([]);
    setDsLoading(true);
    dataStoresApi
      .list(projectId)
      .then((res) => {
        setDataStore(res.data[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setDsLoading(false));
  }, [open, projectId]);

  // 선택 폴더의 이미지 로드
  useEffect(() => {
    if (!dataStore) return;
    setImagesLoading(true);
    imagesApi
      .getFolderContents(dataStore.id, selectedPath)
      .then((res) => setImages(res.data.images ?? []))
      .catch(() => setImages([]))
      .finally(() => setImagesLoading(false));
  }, [dataStore, selectedPath]);

  function toggleImage(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      await tasksApi.addImages(taskId, [...selectedIds], targetFolderPath);
      setSelectedIds(new Set());
      onImagesAdded();
      onClose();
    } catch {
      // silently fail
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      {/* 배경 오버레이 */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
      )}

      {/* 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 z-40 h-full bg-background border-l shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(420px, calc(100vw - 80px))" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Pool에서 이미지 추가</h2>
            <p className="text-xs text-muted-foreground">
              대상:{" "}
              <span className="font-medium text-foreground">
                {targetFolderPath || "/ (루트)"}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 콘텐츠 */}
        {dsLoading ? (
          <div className="flex-1 p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded" />
            ))}
          </div>
        ) : !dataStore ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Data Pool이 없습니다.
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* 폴더 트리 */}
            <div className="w-40 shrink-0 border-r overflow-y-auto p-2">
              <FolderTreeView
                ref={treeRef}
                dataStoreId={dataStore.id}
                selectedPath={selectedPath}
                readOnly
                onSelectPath={setSelectedPath}
                onDeleteFolder={async () => {}}
              />
            </div>

            {/* 이미지 그리드 */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* 경로 + 선택 수 */}
              <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b">
                <span className="text-xs text-muted-foreground truncate">
                  {selectedPath || "/"} ({images.length}개)
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-primary font-medium ml-2 shrink-0">
                    {selectedIds.size}개 선택
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {imagesLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="aspect-square w-full rounded-md"
                      />
                    ))}
                  </div>
                ) : images.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    이 폴더에 이미지가 없습니다.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((image) => {
                      const isSelected = selectedIds.has(image.id);
                      return (
                        <div
                          key={image.id}
                          className="relative cursor-pointer"
                          draggable
                          onDragStart={(e) => {
                            const dragIds = isSelected
                              ? [...selectedIds]
                              : [image.id];
                            e.dataTransfer.setData(
                              "application/x-datapool-items",
                              JSON.stringify({
                                imageIds: dragIds,
                                folderPaths: [],
                                source: "pool",
                              }),
                            );
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => toggleImage(image.id)}
                        >
                          <div
                            className={`overflow-hidden rounded-md border aspect-square transition-all ${
                              isSelected
                                ? "border-primary ring-2 ring-primary"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <img
                              src={imagesApi.getFileUrl(image.id)}
                              alt={image.original_filename}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                <div className="rounded-full bg-primary p-1">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              </div>
                            )}
                          </div>
                          <p
                            className="truncate text-xs text-muted-foreground mt-0.5"
                            title={image.original_filename}
                          >
                            {image.original_filename}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={adding}
          >
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || selectedIds.size === 0}
          >
            {adding ? "추가 중..." : `Task에 추가 (${selectedIds.size}개)`}
          </Button>
        </div>
      </div>
    </>
  );
}
