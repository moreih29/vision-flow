import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Database,
  FolderPlus,
  LayoutGrid,
  List,
  ListTodo,
  Upload,
} from "lucide-react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { tasksApi } from "@/api/tasks";
import { imagesApi } from "@/api/images";
import { dataStoresApi } from "@/api/data-stores";
import {
  ImageQuickLook,
  type QuickLookItem,
} from "@/components/content-viewer/ImageQuickLook";
import { labelClassesApi } from "@/api/label-classes";
import type { Task } from "@/types/task";
import type { LabelClass } from "@/types/label-class";
import type { DataPoolItem, ImageMeta } from "@/types/image";
import type { DataStore } from "@/types/data-store";
import { Button } from "@/components/ui/button";
import FolderBreadcrumb from "@/components/FolderBreadcrumb";
import {
  TaskDetailHeader,
  TaskClassPanel,
  VersionPanel,
} from "@/components/task-detail";
import {
  FileTreeView as FolderTreeView,
  type FileTreeRef as FolderTreeRef,
} from "@/components/file-tree";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageGridCard, ImageListRow } from "@/components/data-pool";
import { ContentArea } from "@/components/content-viewer";
import { useImageDragDrop } from "@/hooks/use-image-drag-drop";
import { useTaskFolderContents } from "@/hooks/use-task-folder-contents";
import { useFolderContents } from "@/hooks/use-folder-contents";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import {
  useTaskBulkRemove,
  useTaskBulkMove,
  useTaskDropItems,
} from "@/hooks/use-task-bulk-operations";
import { useTaskFolderOperations } from "@/hooks/use-task-folder-operations";
import FolderPickerDialog from "@/components/FolderPickerDialog";

const VIEW_MODE_KEY = "task_preview_mode";

export default function TaskDetailPage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(id);
  const taskIdNum = Number(taskId);
  const { confirmDialog, confirm, showAlert } = useConfirmDialog();
  const initialTab =
    searchParams.get("tab") === "versions" ? "snapshots" : "classes";

  // -- Viewer mode --
  const [viewerMode, setViewerMode] = useState<"task" | "pool">("task");
  const [poolCurrentPath, setPoolCurrentPath] = useState("");

  // -- Core state --
  const [task, setTask] = useState<Task | null>(null);
  const [classes, setClasses] = useState<LabelClass[]>([]);
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [taskLoading, setTaskLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [previewMode, setPreviewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_MODE_KEY) as "grid" | "list") || "grid",
  );
  const [dataStore, setDataStore] = useState<DataStore | null>(null);
  const [poolAdding, setPoolAdding] = useState(false);
  const [poolProgress, setPoolProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(
    null,
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [scrollToItemKey, setScrollToItemKey] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(5);
  const [addingClass, setAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const CLASS_COLORS = [
    "#3b82f6",
    "#ef4444",
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#14b8a6",
    "#6366f1",
  ];
  const nextColor = CLASS_COLORS[classes.length % CLASS_COLORS.length];
  const [newClassColor, setNewClassColor] = useState(nextColor);
  const [savingClass, setSavingClass] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<FolderTreeRef>(null);
  const poolTreeRef = useRef<FolderTreeRef>(null);
  const handleBulkRemoveRef = useRef<() => void>(() => {});

  const fetchTaskFolderContents = useCallback(
    async (path: string, skip?: number, limit?: number) => {
      const res = await tasksApi.getFolderContents(
        taskIdNum,
        path,
        skip,
        limit,
      );
      return {
        folders: res.data.folders.map((f) => ({
          ...f,
          count: f.image_count,
        })),
        files: res.data.images.map((img) => ({
          id: img.id,
          name: img.image.original_filename,
          path: (path || "") + img.image.original_filename,
        })),
        totalFiles: res.data.total_images,
      };
    },
    [taskIdNum],
  );

  const fetchTaskAllFolders = useCallback(async () => {
    const res = await tasksApi.getAllFolders(taskIdNum);
    return res.data;
  }, [taskIdNum]);

  const fetchPoolFolderContents = useCallback(
    async (path: string, skip?: number, limit?: number) => {
      const res = await imagesApi.getFolderContents(
        dataStore!.id,
        path,
        skip,
        limit,
      );
      return {
        folders: (res.data.folders ?? []).map((f) => ({
          ...f,
          count: f.image_count,
        })),
        files: (res.data.images ?? []).map((img) => ({
          id: img.id,
          name: img.original_filename,
          path: (path || "") + img.original_filename,
        })),
        totalFiles: res.data.total_images,
      };
    },
    [dataStore],
  );

  const fetchPoolAllFolders = useCallback(async () => {
    const res = await imagesApi.getAllFolders(dataStore!.id);
    return res.data;
  }, [dataStore]);

  // -- Folder contents (React Query) --
  const {
    folders,
    images: taskImages,
    totalImages,
    isLoading: contentsLoading,
    loadingMore,
    loadMoreImages,
    invalidate: invalidateFolderContents,
    invalidateAll,
  } = useTaskFolderContents(taskIdNum, currentPath);

  // -- 데이터풀 폴더 내용 (React Query) --
  const {
    folders: poolFolders,
    images: poolImages,
    totalImages: poolTotalImages,
    isLoading: poolContentsLoading,
    loadingMore: poolLoadingMore,
    loadMoreImages: poolLoadMoreImages,
  } = useFolderContents(dataStore?.id, poolCurrentPath);

  const refreshAll = useCallback(async () => {
    await invalidateAll();
    await treeRef.current?.refresh();
  }, [invalidateAll]);

  const refreshPoolTree = useCallback(async () => {
    try {
      const res = await dataStoresApi.list(projectId);
      setDataStore(res.data[0] ?? null);
    } catch {
      // silently fail
    }
    await poolTreeRef.current?.refresh();
  }, [projectId]);

  // -- Items + selection --
  // DataPoolItem 매핑: image → TaskImageResponse.image (ImageMeta), id는 task_image_id
  const items: DataPoolItem[] = useMemo(
    () => [
      ...(currentPath ? [{ type: "parent" as const, key: "parent:.." }] : []),
      ...folders.map((f) => ({
        type: "folder" as const,
        key: `f:${f.path}`,
        folder: f,
      })),
      ...taskImages.map((ti) => ({
        type: "image" as const,
        key: `i:${ti.id}`, // ti.id = task_image_id
        image: ti.image,
      })),
    ],
    [folders, taskImages, currentPath],
  );

  const itemKeys = useMemo(() => items.map((i) => i.key), [items]);
  const {
    selectedKeys,
    selectedCount,
    handleItemClick,
    toggleItem,
    clearSelection,
    selectAll,
    selectByKey,
    selectTo,
    cursorIndexRef,
  } = useMultiSelect(itemKeys, currentPath);

  // -- 데이터풀 items + 선택 --
  const poolItems: DataPoolItem[] = useMemo(
    () => [
      ...(poolCurrentPath
        ? [{ type: "parent" as const, key: "parent:.." }]
        : []),
      ...poolFolders.map((f) => ({
        type: "folder" as const,
        key: `f:${f.path}`,
        folder: f,
      })),
      ...poolImages.map((img) => ({
        type: "image" as const,
        key: `i:${img.id}`,
        image: img,
      })),
    ],
    [poolFolders, poolImages, poolCurrentPath],
  );

  const poolItemKeys = useMemo(() => poolItems.map((i) => i.key), [poolItems]);
  const {
    selectedKeys: poolSelectedKeys,
    selectedCount: poolSelectedCount,
    handleItemClick: poolHandleItemClick,
    toggleItem: poolToggleItem,
    clearSelection: poolClearSelection,
    selectAll: poolSelectAll,
    selectByKey: poolSelectByKey,
    selectTo: poolSelectTo,
    cursorIndexRef: poolCursorIndexRef,
  } = useMultiSelect(poolItemKeys, poolCurrentPath);

  // 활성 모드에 따른 통합 뷰 데이터
  const activeItems = viewerMode === "pool" ? poolItems : items;
  const activeSelectedKeys =
    viewerMode === "pool" ? poolSelectedKeys : selectedKeys;
  const activeSelectedCount =
    viewerMode === "pool" ? poolSelectedCount : selectedCount;
  const activeHandleItemClick =
    viewerMode === "pool" ? poolHandleItemClick : handleItemClick;
  const activeClearSelection =
    viewerMode === "pool" ? poolClearSelection : clearSelection;
  const activeCursorIndexRef =
    viewerMode === "pool" ? poolCursorIndexRef : cursorIndexRef;

  // 현재 cursor 위치 아이템 기반 QuickLookItem 계산 (활성 모드 기준)
  const quickLookItem = useMemo((): QuickLookItem | null => {
    const idx = activeCursorIndexRef.current;
    const selectedKey =
      activeSelectedKeys.size === 1 ? [...activeSelectedKeys][0] : null;
    const cursorItem =
      idx >= 0
        ? activeItems[idx]
        : selectedKey
          ? (activeItems.find((i) => i.key === selectedKey) ?? null)
          : null;
    if (!cursorItem) return null;
    if (cursorItem.type === "image" && cursorItem.image) {
      const activeImageItems = activeItems.filter(
        (i) => i.type === "image" && i.image,
      );
      const imgIdx = activeImageItems.indexOf(cursorItem);
      const activeTotalImages =
        viewerMode === "pool" ? poolTotalImages : totalImages;
      return {
        type: "image",
        id: cursorItem.image.id,
        filename: cursorItem.image.original_filename,
        width: cursorItem.image.width ?? undefined,
        height: cursorItem.image.height ?? undefined,
        indexInFolder: imgIdx >= 0 ? imgIdx : 0,
        totalInFolder: activeTotalImages,
      };
    }
    if (cursorItem.type === "folder" && cursorItem.folder) {
      return {
        type: "folder",
        name: cursorItem.folder.name,
        folderCount: cursorItem.folder.subfolder_count ?? 0,
        directImageCount: cursorItem.folder.direct_image_count ?? 0,
        imageCount: cursorItem.folder.image_count ?? 0,
      };
    }
    return null;
  }, [
    activeSelectedKeys,
    activeItems,
    activeCursorIndexRef,
    viewerMode,
    poolTotalImages,
    totalImages,
  ]);

  // 선택된 task_image_id 추출 (key가 "i:{task_image_id}")
  const selectedTaskImageIds = useMemo(
    () =>
      [...selectedKeys]
        .filter((k) => k.startsWith("i:"))
        .map((k) => parseInt(k.slice(2))),
    [selectedKeys],
  );
  const selectedFolderPaths = useMemo(
    () =>
      [...selectedKeys]
        .filter((k) => k.startsWith("f:"))
        .map((k) => k.slice(2)),
    [selectedKeys],
  );

  // -- Folder CRUD --
  const folderOpsCallbacks = useMemo(
    () => ({
      confirm,
      showAlert,
      setCurrentPath,
      setRenamingFolderPath,
      invalidateFolderContents,
      refreshTree: () => {
        treeRef.current?.refresh();
      },
    }),
    [confirm, showAlert, invalidateFolderContents],
  );

  const {
    handleRemoveImage,
    handleDeleteFolder,
    handleCreateFolder,
    handleUpdateFolder,
    handleCreateFolderInCurrentPath,
    handleFinishRenameInViewer,
  } = useTaskFolderOperations(
    taskIdNum,
    currentPath,
    folders,
    folderOpsCallbacks,
  );

  // -- Bulk operations --
  const bulkRemoveMutation = useTaskBulkRemove(
    taskIdNum,
    useMemo(
      () => ({
        onSuccess: () => {
          clearSelection();
          refreshAll();
          // task image_count 업데이트
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  image_count: Math.max(
                    0,
                    prev.image_count - selectedTaskImageIds.length,
                  ),
                }
              : prev,
          );
        },
        onError: () => {
          showAlert({ title: "제거에 실패했습니다." });
        },
      }),
      [clearSelection, showAlert, refreshAll, selectedTaskImageIds.length],
    ),
  );

  const bulkMoveMutation = useTaskBulkMove(
    taskIdNum,
    useMemo(
      () => ({
        onSuccess: () => {
          setMoveDialogOpen(false);
          clearSelection();
          refreshAll();
        },
        onError: () => {
          showAlert({ title: "이동에 실패했습니다." });
        },
      }),
      [clearSelection, showAlert, refreshAll],
    ),
  );

  const dropItems = useTaskDropItems(
    taskIdNum,
    useMemo(
      () => ({
        onSuccess: () => {
          clearSelection();
          refreshAll();
        },
        onError: () => {
          showAlert({ title: "이동에 실패했습니다." });
        },
      }),
      [clearSelection, showAlert, refreshAll],
    ),
  );

  // -- 아이템 D&D (폴더 간 이동) --
  const {
    dragOverFolderKey,
    handleDragStart,
    handleDragEnd,
    handleFolderDragOver,
    handleFolderDrop,
    handleFolderDragLeave,
  } = useImageDragDrop({
    selectedKeys,
    onDropItemsOnFolder: async (imageIds, folderPaths, targetPath) => {
      await dropItems.mutate(imageIds, folderPaths, targetPath);
    },
    dragSource: "task",
  });

  // -- Pool D&D (task tree로 드래그 가능하도록) --
  const {
    handleDragStart: poolHandleDragStart,
    handleDragEnd: poolHandleDragEnd,
  } = useImageDragDrop({
    selectedKeys: poolSelectedKeys,
    dragSource: "pool",
  });

  const pendingAutoSelectPathRef = useRef<string | null>(null);
  const pendingFileSelectRef = useRef<number | null>(null);

  // -- Navigation --
  const handleNavigateFolder = useCallback(
    (path: string, autoSelect = false) => {
      if (autoSelect) pendingAutoSelectPathRef.current = path;
      setCurrentPath(path);
      if (path) treeRef.current?.expandToPath(path);
    },
    [],
  );

  // 폴더 진입/상위 이동 후 첫 번째 아이템 자동 선택
  // useMultiSelect 선언(line 216) 이후에 위치하여 resetKey effect보다 나중에 실행되도록 보장
  useEffect(() => {
    if (pendingAutoSelectPathRef.current === null) return;
    if (pendingAutoSelectPathRef.current !== currentPath) return;
    const firstIdx = items[0]?.type === "parent" ? 1 : 0;
    if (items[firstIdx]) {
      pendingAutoSelectPathRef.current = null;
      selectByKey(items[firstIdx].key);
    }
  }, [items, currentPath, selectByKey]);

  // 트리 파일 클릭 후 해당 이미지 선택 (items 갱신 대기)
  // fileId는 task_image_id — 키와 직접 매칭
  useEffect(() => {
    if (pendingFileSelectRef.current === null) return;
    const key = `i:${pendingFileSelectRef.current}`;
    if (itemKeys.includes(key)) {
      pendingFileSelectRef.current = null;
      selectByKey(key);
      setScrollToItemKey(key);
    }
  }, [itemKeys, selectByKey]);

  const handleNavigateUp = useCallback(
    (autoSelect = false) => {
      if (!currentPath) return;
      const parts = currentPath.replace(/\/$/, "").split("/");
      parts.pop();
      const newPath = parts.length > 0 ? parts.join("/") + "/" : "";
      handleNavigateFolder(newPath, autoSelect);
      treeRef.current?.collapseBelow(newPath);
    },
    [currentPath, handleNavigateFolder],
  );

  // -- 데이터풀 모드 네비게이션 핸들러 --
  const poolPendingAutoSelectRef = useRef<string | null>(null);

  const handlePoolNavigateFolder = useCallback(
    (path: string, autoSelect = false) => {
      if (autoSelect) poolPendingAutoSelectRef.current = path;
      setPoolCurrentPath(typeof path === "string" ? path : "");
    },
    [],
  );

  const handlePoolNavigateUp = useCallback(
    (autoSelect = false) => {
      if (!poolCurrentPath) return;
      const parts = poolCurrentPath.replace(/\/$/, "").split("/");
      parts.pop();
      const newPath = parts.length > 0 ? parts.join("/") + "/" : "";
      handlePoolNavigateFolder(newPath, autoSelect);
    },
    [poolCurrentPath, handlePoolNavigateFolder],
  );

  // Pool 폴더 이동 후 첫 번째 아이템 자동 선택
  useEffect(() => {
    if (poolPendingAutoSelectRef.current === null) return;
    if (poolPendingAutoSelectRef.current !== poolCurrentPath) return;
    const firstIdx = poolItems[0]?.type === "parent" ? 1 : 0;
    if (poolItems[firstIdx]) {
      poolPendingAutoSelectRef.current = null;
      poolSelectByKey(poolItems[firstIdx].key);
    }
  }, [poolItems, poolCurrentPath, poolSelectByKey]);

  const handleFileClick = useCallback(
    (path: string, fileId?: number) => {
      if (fileId == null) return;
      setViewerMode("task");
      const lastSlash = path.lastIndexOf("/");
      const parentPath = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "";
      // fileId는 tree에서 전달하는 task_image_id — 키와 직접 매칭
      const key = `i:${fileId}`;
      if (currentPath !== parentPath) {
        pendingFileSelectRef.current = fileId;
        setCurrentPath(parentPath);
      } else {
        selectByKey(key);
        setScrollToItemKey(key);
      }
      viewerRef.current?.focus();
    },
    [currentPath, selectByKey],
  );

  const handlePoolFileClick = useCallback(
    (path: string, fileId?: number) => {
      if (fileId == null) return;
      const lastSlash = path.lastIndexOf("/");
      const parentPath = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "";
      setViewerMode("pool");
      setPoolCurrentPath(parentPath);
      const key = `i:${fileId}`;
      poolSelectByKey(key);
      setScrollToItemKey(key);
      viewerRef.current?.focus();
    },
    [poolSelectByKey],
  );

  // -- Tree handlers --
  const handleItemDrop = useCallback(
    async (e: React.DragEvent, targetPath: string) => {
      const data =
        e.dataTransfer.getData("application/x-task-items") ||
        e.dataTransfer.getData("application/x-datapool-items");
      if (!data) return;
      const { taskImageIds, imageIds, folderPaths, source } = JSON.parse(data);
      if (source === "pool" && dataStore) {
        const counter = { completed: 0, total: 0 };
        const noop = () => {};
        // 이미지 직접 추가
        if (imageIds && imageIds.length > 0) {
          await tasksApi.addImages(taskIdNum, imageIds, targetPath);
        }
        // 폴더 재귀 추가
        if (folderPaths && folderPaths.length > 0) {
          for (const fp of folderPaths) {
            const folderName = fp.replace(/\/$/, "").split("/").pop() || "";
            const taskTarget = targetPath
              ? `${targetPath}${folderName}/`
              : `${folderName}/`;
            await addPoolFoldersToTask(
              dataStore.id,
              fp,
              taskTarget,
              noop,
              counter,
            );
          }
        }
        await refreshAll();
        const res = await tasksApi.get(taskIdNum);
        setTask(res.data);
      } else {
        await dropItems.mutate(
          taskImageIds ?? imageIds ?? [],
          folderPaths ?? [],
          targetPath,
        );
      }
    },
    [taskIdNum, refreshAll, dropItems, dataStore], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // -- Bulk remove --
  async function handleBulkRemove() {
    if (selectedCount === 0) return;
    const confirmed = await confirm({
      title: "항목 제거",
      description: `선택한 ${selectedCount}개 항목을 Task에서 제거하시겠습니까?`,
      confirmLabel: "제거",
      variant: "destructive",
    });
    if (!confirmed) return;
    bulkRemoveMutation.mutate({
      taskImageIds: selectedTaskImageIds,
      folderPaths: selectedFolderPaths,
    });
  }
  useEffect(() => {
    handleBulkRemoveRef.current = handleBulkRemove;
  });

  // -- Keyboard shortcuts --
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (moveDialogOpen) return;
      const isPool = viewerMode === "pool";
      const activeSelectAll = isPool ? poolSelectAll : selectAll;
      const activeClear = isPool ? poolClearSelection : clearSelection;
      const activeSKeys = isPool ? poolSelectedKeys : selectedKeys;
      const activeCount = isPool ? poolSelectedCount : selectedCount;
      const activeItms = isPool ? poolItems : items;
      const activeCursor = isPool ? poolCursorIndexRef : cursorIndexRef;
      const activeNavFolder = isPool
        ? handlePoolNavigateFolder
        : handleNavigateFolder;
      const activeNavUp = isPool ? handlePoolNavigateUp : handleNavigateUp;
      const activeCurPath = isPool ? poolCurrentPath : currentPath;
      const activeSelByKey = isPool ? poolSelectByKey : selectByKey;
      const activeSelTo = isPool ? poolSelectTo : selectTo;

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        activeSelectAll();
      }
      if (e.key === "Escape" && !quickLookOpen) activeClear();
      // Delete: 풀 모드에서는 차단
      if (e.key === "Delete" && activeCount > 0 && !isPool) {
        e.preventDefault();
        handleBulkRemoveRef.current();
      }
      // Backspace: 상위 폴더 이동 (QuickLook 열림 시 차단)
      if (e.key === "Backspace" && !quickLookOpen) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (activeCurPath) {
          e.preventDefault();
          activeNavUp(true);
        }
      }
      // Enter: 폴더 1개 선택 시 진입 (QuickLook 열림 시 차단)
      if (e.key === "Enter" && !quickLookOpen) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (activeSKeys.size === 1) {
          const selectedKey = [...activeSKeys][0];
          const selectedItem = activeItms.find((i) => i.key === selectedKey);
          if (selectedItem?.type === "folder" && selectedItem.folder) {
            e.preventDefault();
            activeNavFolder(selectedItem.folder.path, true);
          }
        }
      }
      // Space 키: QuickLook 열기 (닫기는 모달이 capture phase에서 처리)
      if (e.key === " ") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        if (activeSKeys.size > 0) {
          e.preventDefault();
          setQuickLookOpen(true);
        }
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (quickLookOpen) {
          // QuickLook 열려있을 때도 화살표로 뷰어 선택 이동 허용
        }
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();

        const minIdx = activeItms[0]?.type === "parent" ? 1 : 0;

        let currentIdx: number;
        if (e.shiftKey && activeSKeys.size > 0) {
          currentIdx =
            activeCursor.current >= 0 ? activeCursor.current : minIdx - 1;
        } else if (activeSKeys.size === 0) {
          currentIdx = minIdx - 1;
        } else if (activeCursor.current >= 0) {
          currentIdx = activeCursor.current;
        } else if (activeSKeys.size === 1) {
          const selectedKey = [...activeSKeys][0];
          currentIdx = activeItms.findIndex((i) => i.key === selectedKey);
          if (currentIdx < 0) return;
        } else {
          return;
        }

        let nextIdx = currentIdx;
        if (previewMode === "list") {
          if (e.key === "ArrowUp") nextIdx = currentIdx - 1;
          else if (e.key === "ArrowDown") nextIdx = currentIdx + 1;
          else if (e.key === "ArrowRight") {
            if (!quickLookOpen && !e.shiftKey && activeSKeys.size === 1) {
              const selectedKey = [...activeSKeys][0];
              const selectedItem = activeItms.find(
                (i) => i.key === selectedKey,
              );
              if (selectedItem?.type === "folder" && selectedItem.folder) {
                activeNavFolder(selectedItem.folder.path, true);
              }
            }
            return;
          } else if (e.key === "ArrowLeft") {
            if (!quickLookOpen && !e.shiftKey && activeCurPath) {
              activeNavUp(true);
            }
            return;
          } else return;
        } else {
          if (e.key === "ArrowLeft") nextIdx = currentIdx - 1;
          else if (e.key === "ArrowRight") nextIdx = currentIdx + 1;
          else if (e.key === "ArrowUp") nextIdx = currentIdx - gridColumns;
          else if (e.key === "ArrowDown") nextIdx = currentIdx + gridColumns;
        }

        if (nextIdx < minIdx || nextIdx >= activeItms.length) return;
        if (e.shiftKey) {
          activeSelTo(nextIdx);
        } else {
          const nextKey = activeItms[nextIdx].key;
          activeSelByKey(nextKey);
        }
        setScrollToItemKey(activeItms[nextIdx].key);
      }
    };
    const el = viewerRef.current;
    if (!el) return;
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [
    viewerMode,
    selectAll,
    poolSelectAll,
    clearSelection,
    poolClearSelection,
    selectedCount,
    poolSelectedCount,
    moveDialogOpen,
    selectedKeys,
    poolSelectedKeys,
    items,
    poolItems,
    quickLookOpen,
    previewMode,
    gridColumns,
    selectByKey,
    poolSelectByKey,
    selectTo,
    poolSelectTo,
    cursorIndexRef,
    poolCursorIndexRef,
    currentPath,
    poolCurrentPath,
    handleNavigateFolder,
    handlePoolNavigateFolder,
    handleNavigateUp,
    handlePoolNavigateUp,
  ]);

  // -- DataStore 로드 --
  useEffect(() => {
    dataStoresApi
      .list(projectId)
      .then((res) => setDataStore(res.data[0] ?? null))
      .catch(() => {});
  }, [projectId]);

  // -- Pool 폴더 → Task 재귀 추가 --
  async function addPoolFoldersToTask(
    dsId: number,
    poolPath: string,
    taskTargetPath: string,
    onProgress: (completed: number, total: number) => void,
    counter: { completed: number; total: number },
  ): Promise<{ added: number; moved: number; failed: number }> {
    let added = 0;
    let moved = 0;
    let failed = 0;

    try {
      const allImages: ImageMeta[] = [];
      let skip = 0;
      const batchSize = 500;
      let subfolders: { name: string; path: string }[] = [];
      while (true) {
        const res = await imagesApi.getFolderContents(
          dsId,
          poolPath,
          skip,
          batchSize,
        );
        const batch = res.data.images ?? [];
        if (skip === 0) subfolders = res.data.folders ?? [];
        allImages.push(...batch);
        if (batch.length < batchSize) break;
        skip += batchSize;
      }

      counter.total += allImages.length;
      onProgress(counter.completed, counter.total);

      // 폴더 생성 (이미지 유무와 무관하게)
      if (taskTargetPath) {
        try {
          await tasksApi.createFolder(taskIdNum, taskTargetPath);
        } catch {
          // 이미 존재하면 무시
        }
      }

      if (allImages.length > 0) {
        try {
          for (let i = 0; i < allImages.length; i += 500) {
            const batch = allImages.slice(i, i + 500);
            const res = await tasksApi.addImages(
              taskIdNum,
              batch.map((img) => img.id),
              taskTargetPath,
            );
            added += res.data.added ?? batch.length;
            moved += res.data.moved ?? 0;
          }
        } catch {
          failed += allImages.length;
        }
        counter.completed += allImages.length;
        onProgress(counter.completed, counter.total);
      }

      for (const sub of subfolders) {
        const subName = sub.name;
        const subTaskPath = taskTargetPath
          ? `${taskTargetPath}${subName}/`
          : `${subName}/`;
        const result = await addPoolFoldersToTask(
          dsId,
          sub.path,
          subTaskPath,
          onProgress,
          counter,
        );
        added += result.added;
        moved += result.moved;
        failed += result.failed;
      }
    } catch {
      failed++;
    }

    return { added, moved, failed };
  }

  const [addTargetDialogOpen, setAddTargetDialogOpen] = useState(false);

  // -- Pool 뷰어 선택 → Task에 추가 핸들러 --
  async function handleAddPoolToTask(targetFolder?: string) {
    if (!dataStore || poolAdding) return;
    const destPath = targetFolder ?? currentPath;
    setAddTargetDialogOpen(false);
    setPoolAdding(true);
    setPoolProgress({ completed: 0, total: 0 });
    let totalAdded = 0;
    let totalMoved = 0;
    let totalFailed = 0;
    const counter = { completed: 0, total: 0 };
    const onProgress = (completed: number, total: number) => {
      setPoolProgress({ completed, total });
    };
    try {
      // 선택된 항목이 있으면 선택 기반, 없으면 현재 풀 폴더 전체 추가
      const imageIds: number[] = [];
      let folderPaths: string[] = [];

      if (poolSelectedKeys.size > 0) {
        for (const key of poolSelectedKeys) {
          if (key.startsWith("i:")) {
            imageIds.push(parseInt(key.slice(2)));
          } else if (key.startsWith("f:")) {
            folderPaths.push(key.slice(2));
          }
        }
      } else {
        // 선택 없음 → 현재 풀 폴더 전체
        folderPaths = [poolCurrentPath || ""];
      }

      // 개별 이미지 추가
      if (imageIds.length > 0) {
        counter.total += imageIds.length;
        onProgress(counter.completed, counter.total);
        const res = await tasksApi.addImages(taskIdNum, imageIds, destPath);
        totalAdded += res.data.added ?? imageIds.length;
        totalMoved += res.data.moved ?? 0;
        counter.completed += imageIds.length;
        onProgress(counter.completed, counter.total);
      }

      // 폴더 재귀 추가
      for (const poolPath of folderPaths) {
        const folderName = poolPath
          ? poolPath.replace(/\/$/, "").split("/").pop()!
          : "";
        const taskTarget = folderName
          ? destPath
            ? `${destPath}${folderName}/`
            : `${folderName}/`
          : destPath;
        const result = await addPoolFoldersToTask(
          dataStore.id,
          poolPath,
          taskTarget,
          onProgress,
          counter,
        );
        totalAdded += result.added;
        totalMoved += result.moved;
        totalFailed += result.failed;
      }

      poolClearSelection();
      await handleImagesAdded();
      if (totalFailed > 0) {
        await showAlert({
          title: `${totalAdded}개 추가됨, ${totalFailed}개 실패`,
        });
      } else if (totalMoved > 0) {
        toast.info(`${totalAdded}개 추가, ${totalMoved}개 기존 이미지 이동`);
      }
    } catch {
      await showAlert({ title: "추가 중 오류가 발생했습니다." });
    } finally {
      setPoolAdding(false);
      setPoolProgress(null);
    }
  }

  // -- Task + Classes 로드 --
  useEffect(() => {
    async function fetchMeta() {
      setTaskLoading(true);
      setError(null);
      try {
        const [taskRes, classesRes] = await Promise.all([
          tasksApi.get(taskIdNum),
          labelClassesApi.list(taskIdNum),
        ]);
        setTask(taskRes.data);
        setClasses(classesRes.data);
      } catch {
        setError("데이터를 불러오지 못했습니다.");
      } finally {
        setTaskLoading(false);
      }
    }
    fetchMeta();
  }, [taskIdNum]);

  // -- Class CRUD --
  async function handleAddClass() {
    if (!newClassName.trim()) return;
    setSavingClass(true);
    try {
      const res = await labelClassesApi.create(taskIdNum, {
        name: newClassName.trim(),
        color: newClassColor,
      });
      setClasses((prev) => [...prev, res.data]);
      setTask((prev) =>
        prev ? { ...prev, class_count: prev.class_count + 1 } : prev,
      );
      setNewClassName("");
      setNewClassColor(
        CLASS_COLORS[(classes.length + 1) % CLASS_COLORS.length],
      );
      setAddingClass(false);
    } catch {
      await showAlert({ title: "클래스 추가에 실패했습니다." });
    } finally {
      setSavingClass(false);
    }
  }

  async function handleDeleteClass(classId: number) {
    const confirmed = await confirm({
      title: "클래스 삭제",
      description: "클래스를 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await labelClassesApi.delete(classId);
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      setTask((prev) =>
        prev
          ? { ...prev, class_count: Math.max(0, prev.class_count - 1) }
          : prev,
      );
    } catch {
      await showAlert({ title: "클래스 삭제에 실패했습니다." });
    }
  }

  async function handleImagesAdded() {
    await refreshAll();
    const res = await tasksApi.get(taskIdNum);
    setTask(res.data);
  }

  // -- Toolbar --
  const activeCurrentPath =
    viewerMode === "pool" ? poolCurrentPath : currentPath;
  const activeNavigate =
    viewerMode === "pool" ? handlePoolNavigateFolder : handleNavigateFolder;
  const activeContentsLoading =
    viewerMode === "pool" ? poolContentsLoading : contentsLoading;
  const activeFolders = viewerMode === "pool" ? poolFolders : folders;
  const activeTotalImages =
    viewerMode === "pool" ? poolTotalImages : totalImages;

  const toolbar = (
    <div className="mb-4 select-none shrink-0 space-y-1">
      <FolderBreadcrumb
        currentPath={activeCurrentPath}
        onNavigate={(path) => activeNavigate(path ? path + "/" : "")}
        prefix={
          viewerMode === "pool" ? (
            <span className="shrink-0 text-blue-500 font-medium">
              Data Pool
            </span>
          ) : (
            <span className="shrink-0 text-emerald-600 font-medium">Task</span>
          )
        }
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {activeContentsLoading
            ? "로딩 중..."
            : `${activeFolders.length > 0 ? `${activeFolders.length}개 폴더, ` : ""}${activeTotalImages}개 이미지`}
        </span>
        <div className="flex items-center gap-2">
          {viewerMode === "pool" && (
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={poolAdding}
              onClick={() => setAddTargetDialogOpen(true)}
            >
              {poolAdding
                ? poolProgress
                  ? `추가 중... (${poolProgress.completed}/${poolProgress.total})`
                  : "추가 중..."
                : poolSelectedCount > 0
                  ? `Task에 추가 (${poolSelectedCount})`
                  : "전체 추가"}
            </Button>
          )}
          {viewerMode === "task" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateFolderInCurrentPath}
            >
              <FolderPlus className="mr-1 h-3.5 w-3.5" />새 폴더
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={previewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setPreviewMode("grid");
                localStorage.setItem(VIEW_MODE_KEY, "grid");
              }}
              title="격자 보기"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setPreviewMode("list");
                localStorage.setItem(VIEW_MODE_KEY, "list");
              }}
              title="리스트 보기"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <TaskDetailHeader
        task={task}
        loading={taskLoading}
        onBack={() => navigate(`/projects/${projectId}`)}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 min-h-0 h-0 overflow-hidden">
        {error && (
          <div className="mb-4 shrink-0 rounded-md bg-destructive/10 p-3 text-sm text-destructive select-text">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-6 min-h-0">
          {/* 좌측: Pool + Task 수직 사이드바 */}
          <div className="w-64 shrink-0 flex flex-col gap-2 min-h-0">
            {/* Pool 섹션 */}
            <div
              className={`flex-1 rounded-lg border flex flex-col min-h-0 transition-opacity ${
                viewerMode === "pool"
                  ? "border-blue-400 ring-1 ring-blue-400"
                  : "opacity-50"
              }`}
            >
              {!dataStore ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Data Pool이 없습니다.
                </p>
              ) : (
                <FolderTreeView
                  ref={poolTreeRef}
                  readOnly
                  fetchFolderContents={fetchPoolFolderContents}
                  fetchAllFolders={fetchPoolAllFolders}
                  rootLabel="Data Pool"
                  rootIcon={
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                  }
                  rootCount={dataStore.image_count ?? 0}
                  onRefresh={refreshPoolTree}
                  selectedPath={
                    viewerMode === "pool" ? poolCurrentPath : undefined
                  }
                  onSelectPath={(path) => {
                    setViewerMode("pool");
                    handlePoolNavigateFolder(path);
                  }}
                  onFileClick={handlePoolFileClick}
                />
              )}
            </div>

            {/* Task 섹션 */}
            <div
              className={`flex-1 rounded-lg border p-2 flex flex-col overflow-hidden min-h-0 transition-opacity ${
                viewerMode === "task"
                  ? "border-emerald-500 ring-1 ring-emerald-500"
                  : "opacity-50"
              }`}
            >
              <FolderTreeView
                ref={treeRef}
                fetchFolderContents={fetchTaskFolderContents}
                fetchAllFolders={fetchTaskAllFolders}
                rootLabel={task?.name ?? "Task"}
                rootCount={task?.image_count ?? 0}
                rootIcon={
                  <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                }
                selectedPath={currentPath}
                acceptDropTypes={[
                  "application/x-task-items",
                  "application/x-datapool-items",
                ]}
                onSelectPath={(path) => {
                  setViewerMode("task");
                  handleNavigateFolder(path);
                }}
                onFileClick={handleFileClick}
                onDeleteFolder={handleDeleteFolder}
                onUpdateFolder={handleUpdateFolder}
                onCreateFolder={handleCreateFolder}
                onItemDrop={handleItemDrop}
                onRefresh={refreshAll}
              />
            </div>
          </div>

          {/* 중앙: 콘텐츠 영역 */}
          <div
            ref={viewerRef}
            tabIndex={-1}
            className={`min-w-0 flex-1 flex flex-col min-h-0 outline-none rounded-lg border transition-colors ${
              viewerMode === "pool" ? "border-blue-400" : "border-emerald-500"
            } p-2`}
            onMouseDown={() => viewerRef.current?.focus()}
          >
            {toolbar}
            <ContentArea
              items={activeItems}
              contentsLoading={activeContentsLoading}
              previewMode={previewMode}
              selectedKeys={activeSelectedKeys}
              hasMore={
                viewerMode === "pool"
                  ? poolImages.length < poolTotalImages
                  : taskImages.length < totalImages
              }
              loadingMore={
                viewerMode === "pool" ? poolLoadingMore : loadingMore
              }
              onLoadMore={
                viewerMode === "pool" ? poolLoadMoreImages : loadMoreImages
              }
              onItemClick={activeHandleItemClick}
              onClearSelection={activeClearSelection}
              hasParentItem={
                activeItems.length > 0 && activeItems[0].type === "parent"
              }
              onNavigateUp={
                activeCurrentPath
                  ? viewerMode === "pool"
                    ? handlePoolNavigateUp
                    : handleNavigateUp
                  : undefined
              }
              totalCount={
                activeTotalImages > 0
                  ? activeFolders.length + activeTotalImages
                  : undefined
              }
              scrollToItemKey={scrollToItemKey}
              onScrollComplete={() => setScrollToItemKey(null)}
              onColumnsChange={(cols) => setGridColumns(cols)}
              renderBgMenu={
                viewerMode === "task"
                  ? (close) => (
                      <button
                        type="button"
                        className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          close();
                          handleCreateFolderInCurrentPath();
                        }}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />새 폴더
                      </button>
                    )
                  : undefined
              }
              renderGridItem={(item, flatIndex, isSelected) => (
                <ImageGridCard
                  key={item.key}
                  item={item as DataPoolItem}
                  flatIndex={flatIndex}
                  isSelected={isSelected}
                  selectedCount={activeSelectedCount}
                  renamingFolderPath={
                    viewerMode === "task" ? renamingFolderPath : null
                  }
                  dragOverFolderKey={
                    viewerMode === "task" ? dragOverFolderKey : null
                  }
                  deleteLabel="제거"
                  onItemClick={activeHandleItemClick}
                  onCheckboxClick={
                    viewerMode === "pool" ? poolToggleItem : toggleItem
                  }
                  onNavigateFolder={
                    viewerMode === "pool"
                      ? handlePoolNavigateFolder
                      : handleNavigateFolder
                  }
                  onRenameFolder={
                    viewerMode === "task"
                      ? (path) => setRenamingFolderPath(path)
                      : undefined
                  }
                  onFinishRenameFolder={
                    viewerMode === "task"
                      ? handleFinishRenameInViewer
                      : undefined
                  }
                  onCancelRenameFolder={
                    viewerMode === "task"
                      ? () => setRenamingFolderPath(null)
                      : undefined
                  }
                  onMoveSelected={
                    viewerMode === "task"
                      ? () => setMoveDialogOpen(true)
                      : undefined
                  }
                  onDeleteSelected={
                    viewerMode === "task" ? handleBulkRemove : undefined
                  }
                  onDeleteFolder={
                    viewerMode === "task" ? handleDeleteFolder : undefined
                  }
                  onDeleteImage={
                    viewerMode === "task" ? handleRemoveImage : undefined
                  }
                  onImageDoubleClick={() => {
                    setQuickLookOpen(true);
                  }}
                  onContextMenu={(contextItem, index) => {
                    if (!activeSelectedKeys.has(contextItem.key)) {
                      activeHandleItemClick(
                        index,
                        new MouseEvent("click") as unknown as React.MouseEvent,
                      );
                    }
                  }}
                  onDragStart={
                    viewerMode === "task"
                      ? handleDragStart
                      : poolHandleDragStart
                  }
                  onDragEnd={
                    viewerMode === "task" ? handleDragEnd : poolHandleDragEnd
                  }
                  onFolderDragOver={
                    viewerMode === "task" ? handleFolderDragOver : undefined
                  }
                  onFolderDragLeave={
                    viewerMode === "task" ? handleFolderDragLeave : undefined
                  }
                  onFolderDrop={
                    viewerMode === "task" ? handleFolderDrop : undefined
                  }
                />
              )}
              renderListItem={(
                item,
                virtualRowIndex,
                isSelected,
                virtualRow,
              ) => (
                <ImageListRow
                  key={`row-${virtualRowIndex}`}
                  item={item as DataPoolItem}
                  virtualRowIndex={virtualRowIndex}
                  virtualRowSize={virtualRow.size}
                  virtualRowStart={virtualRow.start}
                  isSelected={isSelected}
                  selectedCount={activeSelectedCount}
                  renamingFolderPath={
                    viewerMode === "task" ? renamingFolderPath : null
                  }
                  dragOverFolderKey={
                    viewerMode === "task" ? dragOverFolderKey : null
                  }
                  deleteLabel="제거"
                  onItemClick={activeHandleItemClick}
                  onCheckboxClick={
                    viewerMode === "pool" ? poolToggleItem : toggleItem
                  }
                  onNavigateFolder={
                    viewerMode === "pool"
                      ? handlePoolNavigateFolder
                      : handleNavigateFolder
                  }
                  onRenameFolder={
                    viewerMode === "task"
                      ? (path) => setRenamingFolderPath(path)
                      : undefined
                  }
                  onFinishRenameFolder={
                    viewerMode === "task"
                      ? handleFinishRenameInViewer
                      : undefined
                  }
                  onCancelRenameFolder={
                    viewerMode === "task"
                      ? () => setRenamingFolderPath(null)
                      : undefined
                  }
                  onMoveSelected={
                    viewerMode === "task"
                      ? () => setMoveDialogOpen(true)
                      : undefined
                  }
                  onDeleteSelected={
                    viewerMode === "task" ? handleBulkRemove : undefined
                  }
                  onDeleteFolder={
                    viewerMode === "task" ? handleDeleteFolder : undefined
                  }
                  onDeleteImage={
                    viewerMode === "task" ? handleRemoveImage : undefined
                  }
                  onImageDoubleClick={() => {
                    setQuickLookOpen(true);
                  }}
                  onContextMenu={(contextItem, index) => {
                    if (!activeSelectedKeys.has(contextItem.key)) {
                      activeHandleItemClick(
                        index,
                        new MouseEvent("click") as unknown as React.MouseEvent,
                      );
                    }
                  }}
                  onDragStart={
                    viewerMode === "task"
                      ? handleDragStart
                      : poolHandleDragStart
                  }
                  onDragEnd={
                    viewerMode === "task" ? handleDragEnd : poolHandleDragEnd
                  }
                  onFolderDragOver={
                    viewerMode === "task" ? handleFolderDragOver : undefined
                  }
                  onFolderDragLeave={
                    viewerMode === "task" ? handleFolderDragLeave : undefined
                  }
                  onFolderDrop={
                    viewerMode === "task" ? handleFolderDrop : undefined
                  }
                />
              )}
              renderListHeader={() => (
                <div className="flex border-b bg-muted/80 text-sm font-medium">
                  <div className="w-10 shrink-0 px-3 py-2" />
                  <div className="w-12 shrink-0 px-3 py-2" />
                  <div className="flex-1 px-3 py-2">파일명</div>
                  <div className="w-24 shrink-0 px-3 py-2">크기</div>
                  <div className="w-28 shrink-0 px-3 py-2">해상도</div>
                  <div className="w-16 shrink-0 px-3 py-2" />
                </div>
              )}
              renderEmpty={() => (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {viewerMode === "pool"
                      ? "Data Pool에 항목이 없습니다."
                      : "이 Task에 항목이 없습니다."}
                  </p>
                  {viewerMode === "task" && (
                    <p className="text-xs text-muted-foreground">
                      좌측 Data Pool에서 항목을 추가하세요.
                    </p>
                  )}
                </div>
              )}
            />
          </div>

          {/* 우측: 클래스 + 스냅샷 탭 패널 */}
          <div className="w-64 shrink-0 flex flex-col min-h-0">
            <Tabs defaultValue={initialTab} className="flex flex-col h-full">
              <TabsList className="w-full shrink-0">
                <TabsTrigger value="classes" className="flex-1">
                  클래스
                </TabsTrigger>
                <TabsTrigger value="snapshots" className="flex-1">
                  버전
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="classes"
                className="flex-1 overflow-y-auto mt-2"
              >
                <TaskClassPanel
                  classes={classes}
                  loading={taskLoading}
                  addingClass={addingClass}
                  newClassName={newClassName}
                  newClassColor={newClassColor}
                  savingClass={savingClass}
                  onStartAdding={() => setAddingClass(true)}
                  onCancelAdding={() => setAddingClass(false)}
                  onNewClassNameChange={setNewClassName}
                  onNewClassColorChange={setNewClassColor}
                  onAddClass={handleAddClass}
                  onDeleteClass={handleDeleteClass}
                />
              </TabsContent>
              <TabsContent
                value="snapshots"
                className="flex-1 overflow-hidden mt-2"
              >
                <VersionPanel taskId={taskIdNum} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* 이동 대상 폴더 선택 */}
      <FolderPickerDialog
        fetchFolderContents={fetchTaskFolderContents}
        fetchAllFolders={fetchTaskAllFolders}
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        onSelect={(targetFolder) => {
          bulkMoveMutation.mutate({
            taskImageIds: selectedTaskImageIds,
            folderPaths: selectedFolderPaths,
            targetFolder,
          });
        }}
        excludePaths={selectedFolderPaths}
      />

      {/* 추가 대상 폴더 선택 */}
      <FolderPickerDialog
        fetchFolderContents={fetchTaskFolderContents}
        fetchAllFolders={fetchTaskAllFolders}
        open={addTargetDialogOpen}
        onClose={() => setAddTargetDialogOpen(false)}
        onSelect={(targetFolder) => handleAddPoolToTask(targetFolder)}
        title="추가할 대상 폴더 선택"
        confirmLabel="추가"
      />

      <ImageQuickLook
        item={quickLookOpen ? quickLookItem : null}
        open={quickLookOpen}
        onOpenChange={(open) => setQuickLookOpen(open)}
        getImageUrl={(id) => imagesApi.getFileUrl(id)}
      />

      {confirmDialog}
    </div>
  );
}
