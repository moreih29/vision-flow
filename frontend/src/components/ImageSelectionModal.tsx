import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Database,
} from "lucide-react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { dataStoresApi } from "@/api/data-stores";
import { imagesApi } from "@/api/images";
import { tasksApi } from "@/api/tasks";
import type { DataStore } from "@/types/data-store";
import type { FolderInfo, ImageMeta } from "@/types/image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  taskId: number;
  existingImages: ImageMeta[];
  onChanged: (result: { added: number[]; removed: number[] }) => void;
}

interface TreeNode {
  path: string;
  name: string;
  image_count: number;
  subfolder_count: number;
  children?: TreeNode[];
  expanded: boolean;
  loaded: boolean;
}

type CheckState = "checked" | "unchecked" | "indeterminate";

export default function ImageSelectionModal({
  open,
  onOpenChange,
  projectId,
  taskId,
  existingImages,
  onChanged,
}: ImageSelectionModalProps) {
  const { confirmDialog, showAlert } = useConfirmDialog();
  const [dataStore, setDataStore] = useState<DataStore | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [taskImageMetas, setTaskImageMetas] = useState<Map<number, ImageMeta>>(
    new Map(),
  );
  const [adding, setAdding] = useState(false);
  const [folderImageIds, setFolderImageIds] = useState<Map<string, number[]>>(
    new Map(),
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [rootExpanded, setRootExpanded] = useState(true);
  const [rootImageCount, setRootImageCount] = useState(0);

  const existingIdSet = useMemo(
    () => new Set(existingImages.map((img) => img.id)),
    [existingImages],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedIdSetRef = useRef<Set<number>>(new Set());
  selectedIdSetRef.current = selectedIdSet;

  useEffect(() => {
    if (open) {
      setSelectedIds(existingImages.map((i) => i.id));
      setTaskImageMetas(new Map(existingImages.map((i) => [i.id, i])));
      setSelectedPath("");
      setTreeNodes([]);
      setImages([]);
      setFolderImageIds(new Map());
      setLoadingPaths(new Set());
      setRootExpanded(true);
      setRootImageCount(0);
      initDataStore();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (dataStore && open) {
      fetchImages(selectedPath);
    }
  }, [dataStore?.id, selectedPath, open]);

  async function initDataStore() {
    setLoading(true);
    try {
      const res = await dataStoresApi.list(projectId);
      if (res.data.length > 0) {
        const ds = res.data[0];
        setDataStore(ds);
        await loadRootFolders(ds.id);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }

  async function loadRootFolders(dataStoreId: number) {
    try {
      const res = await imagesApi.getFolderContents(dataStoreId, "");
      const nodes: TreeNode[] = res.data.folders.map((f: FolderInfo) => ({
        path: f.path,
        name: f.name,
        image_count: f.image_count,
        subfolder_count: f.subfolder_count,
        expanded: false,
        loaded: false,
      }));
      setTreeNodes(nodes);
      const totalCount =
        (res.data.total_images ?? 0) +
        nodes.reduce((sum, n) => sum + n.image_count, 0);
      setRootImageCount(totalCount);
    } catch {
      /* silently fail */
    }
  }

  async function fetchImages(path: string) {
    if (!dataStore) return;
    setImagesLoading(true);
    try {
      const res = await imagesApi.getFolderContents(dataStore.id, path);
      setImages(res.data.images);
    } catch {
      /* silently fail */
    } finally {
      setImagesLoading(false);
    }
  }

  async function toggleExpand(nodePath: string) {
    if (!dataStore) return;

    const updateNodes = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        if (node.path === nodePath) {
          if (!node.loaded) {
            return { ...node, expanded: true };
          }
          return { ...node, expanded: !node.expanded };
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });

    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const n of nodes) {
        if (n.path === nodePath) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(treeNodes);
    if (node && !node.loaded) {
      try {
        const res = await imagesApi.getFolderContents(dataStore.id, nodePath);
        const children: TreeNode[] = res.data.folders.map((f: FolderInfo) => ({
          path: f.path,
          name: f.name,
          image_count: f.image_count,
          subfolder_count: f.subfolder_count,
          expanded: false,
          loaded: false,
        }));

        const loadChildren = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map((n) => {
            if (n.path === nodePath) {
              return { ...n, expanded: true, loaded: true, children };
            }
            if (n.children) {
              return { ...n, children: loadChildren(n.children) };
            }
            return n;
          });

        setTreeNodes(loadChildren(treeNodes));
      } catch {
        /* silently fail */
      }
    } else {
      setTreeNodes(updateNodes(treeNodes));
    }
  }

  const handlePoolImageClick = useCallback(
    (imageId: number) => {
      const currentSet = selectedIdSetRef.current;
      if (currentSet.has(imageId)) {
        // 이미 선택됨 → 제거 (existingIdSet에 있어도 Task에서 빼기 가능)
        setSelectedIds((prev) => prev.filter((id) => id !== imageId));
      } else {
        // 없으면 추가 + taskImageMetas에 메타 저장
        const meta = images.find((img) => img.id === imageId);
        if (meta) {
          setTaskImageMetas((prev) => new Map(prev).set(imageId, meta));
        }
        setSelectedIds((prev) => [...prev, imageId]);
      }
    },
    [images],
  );

  const handleTaskImageClick = useCallback((imageId: number) => {
    // Task 패널에서 클릭 → selectedIds에서 제거 (taskImageMetas는 유지)
    setSelectedIds((prev) => prev.filter((id) => id !== imageId));
  }, []);

  const handleSelectAllInFolder = () => {
    const selectableIds = images
      .filter((img) => !existingIdSet.has(img.id))
      .map((img) => img.id);
    const allSelected = selectableIds.every((id) => selectedIdSet.has(id));
    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !selectableIds.includes(id)),
      );
    } else {
      // 추가되는 이미지들의 메타 저장
      setTaskImageMetas((prev) => {
        const next = new Map(prev);
        for (const img of images) {
          if (selectableIds.includes(img.id)) {
            next.set(img.id, img);
          }
        }
        return next;
      });
      setSelectedIds((prev) => [...new Set([...prev, ...selectableIds])]);
    }
  };

  async function getFolderIds(path: string): Promise<number[]> {
    if (!dataStore) return [];
    const cached = folderImageIds.get(path);
    if (cached !== undefined) return cached;
    const res = await imagesApi.getFolderImageIds(dataStore.id, path);
    const ids = res.data.image_ids;
    setFolderImageIds((prev) => new Map(prev).set(path, ids));
    return ids;
  }

  async function handleFolderCheck(path: string) {
    if (loadingPaths.has(path)) return;
    setLoadingPaths((prev) => new Set(prev).add(path));
    try {
      const ids = await getFolderIds(path);
      const newSelectableIds = ids.filter((id) => !existingIdSet.has(id));
      const currentSet = selectedIdSetRef.current;
      const allSelected =
        newSelectableIds.length > 0 &&
        newSelectableIds.every((id) => currentSet.has(id));

      if (allSelected) {
        // 해제: 새로 추가한 것만 제거 (기존 Task 이미지는 건드리지 않음)
        setSelectedIds((prev) =>
          prev.filter((id) => !newSelectableIds.includes(id)),
        );
      } else {
        setSelectedIds((prev) => [...new Set([...prev, ...newSelectableIds])]);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }

  function getCheckState(path: string): CheckState {
    const cached = folderImageIds.get(path);
    if (cached !== undefined) {
      const selectableIds = cached.filter((id) => !existingIdSet.has(id));
      if (selectableIds.length === 0) return "unchecked";
      const selectedCount = selectableIds.filter((id) =>
        selectedIdSet.has(id),
      ).length;
      if (selectedCount === 0) return "unchecked";
      if (selectedCount === selectableIds.length) return "checked";
      return "indeterminate";
    }

    // 직접 캐시가 없으면 조상 폴더의 캐시를 확인
    for (const [cachedPath, cachedIds] of folderImageIds) {
      if (path !== cachedPath && path.startsWith(cachedPath)) {
        const selectableIds = cachedIds.filter((id) => !existingIdSet.has(id));
        if (
          selectableIds.length > 0 &&
          selectableIds.every((id) => selectedIdSet.has(id))
        ) {
          return "checked";
        }
      }
    }

    return "unchecked";
  }

  const { toAdd, toRemove } = useMemo(
    () => ({
      toAdd: selectedIds.filter((id) => !existingIdSet.has(id)),
      toRemove: [...existingIdSet].filter((id) => !selectedIdSet.has(id)),
    }),
    [selectedIds, existingIdSet, selectedIdSet],
  );

  async function handleApply() {
    if (toAdd.length === 0 && toRemove.length === 0) return;
    setAdding(true);
    try {
      if (toAdd.length > 0) await tasksApi.addImages(taskId, toAdd);
      if (toRemove.length > 0) await tasksApi.removeImages(taskId, toRemove);
      onChanged({ added: toAdd, removed: toRemove });
      onOpenChange(false);
    } catch {
      await showAlert({ title: "변경 적용에 실패했습니다." });
    } finally {
      setAdding(false);
    }
  }

  const selectableImages = images.filter((img) => !existingIdSet.has(img.id));
  const allFolderSelected =
    selectableImages.length > 0 &&
    selectableImages.every((img) => selectedIdSet.has(img.id));

  function CheckboxNode({
    path,
    isLoading,
  }: {
    path: string;
    isLoading: boolean;
  }) {
    const state = getCheckState(path);
    return (
      <input
        type="checkbox"
        ref={(el) => {
          if (el) el.indeterminate = state === "indeterminate";
        }}
        checked={state === "checked"}
        disabled={isLoading}
        onChange={(e) => {
          e.stopPropagation();
          handleFolderCheck(path);
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer disabled:cursor-wait"
      />
    );
  }

  function renderTreeNode(node: TreeNode, depth: number = 0) {
    const isSelected = selectedPath === node.path;
    const hasChildren = node.subfolder_count > 0;
    const isLoading = loadingPaths.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 rounded-sm px-2 py-1 text-sm cursor-pointer hover:bg-accent ${
            isSelected ? "bg-accent font-medium" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedPath(node.path)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="shrink-0 p-0.5 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.path);
              }}
            >
              {node.expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <CheckboxNode path={node.path} isLoading={isLoading} />
          {node.expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {node.image_count}
          </span>
        </div>
        {node.expanded && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderTaskPanel() {
    const removedIds = [...existingIdSet].filter(
      (id) => !selectedIdSet.has(id),
    );
    return (
      <div className="flex-[2] flex flex-col min-h-0 rounded-md border">
        <div className="p-2 border-b shrink-0">
          <p className="text-sm font-medium">
            Task 이미지 ({selectedIds.length}개)
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-3 gap-2">
            {selectedIds.map((id) => {
              const meta = taskImageMetas.get(id);
              if (!meta) return null;
              const isNew = !existingIdSet.has(id);
              return (
                <div
                  key={id}
                  className="relative cursor-pointer"
                  onClick={() => handleTaskImageClick(id)}
                >
                  <div
                    className={`overflow-hidden rounded-md border aspect-square ${isNew ? "border-primary ring-1 ring-primary" : "border-border"}`}
                  >
                    <img
                      src={imagesApi.getFileUrl(id)}
                      alt={meta.original_filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {isNew && (
                    <span className="absolute top-1 right-1 rounded bg-primary px-1 py-0.5 text-[10px] text-primary-foreground">
                      추가
                    </span>
                  )}
                </div>
              );
            })}
            {removedIds.map((id) => {
              const meta = taskImageMetas.get(id);
              if (!meta) return null;
              return (
                <div
                  key={id}
                  className="relative cursor-pointer opacity-40"
                  onClick={() => setSelectedIds((prev) => [...prev, id])}
                >
                  <div className="overflow-hidden rounded-md border border-destructive aspect-square">
                    <img
                      src={imagesApi.getFileUrl(id)}
                      alt={meta.original_filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span className="absolute top-1 right-1 rounded bg-destructive px-1 py-0.5 text-[10px] text-destructive-foreground">
                    제거
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>이미지 관리</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        ) : !dataStore ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Data Pool이 없습니다.
          </div>
        ) : (
          <div className="flex gap-3 flex-1 min-h-0">
            {/* 폴더 트리 */}
            <div className="w-[220px] shrink-0 overflow-y-auto rounded-md border p-2 select-none">
              <div
                className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm cursor-pointer hover:bg-accent ${
                  selectedPath === "" ? "bg-accent font-medium" : ""
                }`}
                onClick={() => setSelectedPath("")}
              >
                <button
                  type="button"
                  className="shrink-0 p-0.5 hover:bg-muted rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRootExpanded((prev) => !prev);
                  }}
                >
                  {rootExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                <CheckboxNode path="" isLoading={loadingPaths.has("")} />
                <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">Data Pool</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {rootImageCount}
                </span>
              </div>
              {rootExpanded && treeNodes.map((node) => renderTreeNode(node, 1))}
            </div>

            {/* Pool 이미지 */}
            <div className="flex-[3] flex flex-col min-h-0">
              <div className="mb-2 flex items-center justify-between select-none shrink-0">
                <p className="text-sm text-muted-foreground">
                  {selectedPath || "/"} ({images.length}개)
                </p>
                {selectableImages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllInFolder}
                  >
                    {allFolderSelected ? "전체 해제" : "전체 선택"}
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {imagesLoading ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, i) => (
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
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {images.map((image) => {
                      const isExisting = existingIdSet.has(image.id);
                      const isImgSelected = selectedIdSet.has(image.id);
                      // Pool 패널 상태:
                      // isExisting && isImgSelected: 포함됨 (체크마크 + opacity-60)
                      // !isExisting && isImgSelected: 추가 예정 (primary ring + 체크)
                      // !isImgSelected: 기본 상태
                      const isIncluded = isExisting && isImgSelected;
                      const isToAdd = !isExisting && isImgSelected;
                      return (
                        <div
                          key={image.id}
                          className={`relative flex cursor-pointer flex-col gap-1 ${
                            isIncluded ? "opacity-60" : ""
                          }`}
                          onClick={() => handlePoolImageClick(image.id)}
                        >
                          <div
                            className={`relative overflow-hidden rounded-md border aspect-square transition-all ${
                              isIncluded
                                ? "border-border bg-muted"
                                : isToAdd
                                  ? "border-primary ring-2 ring-primary"
                                  : "border-border bg-muted hover:border-primary/50"
                            }`}
                          >
                            <img
                              src={imagesApi.getFileUrl(image.id)}
                              alt={image.original_filename}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {isIncluded && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                <span className="rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium">
                                  포함됨
                                </span>
                              </div>
                            )}
                            {isToAdd && (
                              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                <div className="rounded-full bg-primary p-1">
                                  <svg
                                    className="h-3 w-3 text-primary-foreground"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                          <p
                            className="truncate text-xs text-muted-foreground select-text"
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

            {/* Task 이미지 패널 */}
            {renderTaskPanel()}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {(() => {
              if (toAdd.length === 0 && toRemove.length === 0)
                return "변경 사항 없음";
              const parts = [];
              if (toAdd.length > 0) parts.push(`+${toAdd.length}개 추가`);
              if (toRemove.length > 0) parts.push(`-${toRemove.length}개 제거`);
              return parts.join(" / ");
            })()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adding}
            >
              취소
            </Button>
            <Button
              onClick={handleApply}
              disabled={adding || (toAdd.length === 0 && toRemove.length === 0)}
            >
              {adding ? "적용 중..." : "적용"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}
