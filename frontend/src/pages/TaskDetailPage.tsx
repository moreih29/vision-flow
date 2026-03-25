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
import { useMultiSelect } from "@/hooks/useMultiSelect";
import {
  useTaskBulkRemove,
  useTaskBulkMove,
  useTaskDropItems,
} from "@/hooks/use-task-bulk-operations";
import { useTaskFolderOperations } from "@/hooks/use-task-folder-operations";

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

  // -- Core state --
  const [task, setTask] = useState<Task | null>(null);
  const [classes, setClasses] = useState<LabelClass[]>([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [previewMode, setPreviewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_MODE_KEY) as "grid" | "list") || "grid",
  );
  const [poolCollapsed, setPoolCollapsed] = useState(false);
  const [poolCheckedPaths, setPoolCheckedPaths] = useState<
    Map<string, { count: number; fileId?: number }>
  >(new Map());
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
  } = useMultiSelect(itemKeys, currentPath);

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

  const hasParentItem = items.length > 0 && items[0].type === "parent";

  // -- Navigation --
  const handleNavigateFolder = useCallback(
    (path: string) => {
      clearSelection();
      setCurrentPath(path);
    },
    [clearSelection],
  );

  const handleNavigateUp = useCallback(() => {
    if (!currentPath) return;
    const parts = currentPath.replace(/\/$/, "").split("/");
    parts.pop();
    handleNavigateFolder(parts.length > 0 ? parts.join("/") + "/" : "");
  }, [currentPath, handleNavigateFolder]);

  // -- Tree handlers --
  const handleItemDrop = useCallback(
    async (e: React.DragEvent, targetPath: string) => {
      const data =
        e.dataTransfer.getData("application/x-task-items") ||
        e.dataTransfer.getData("application/x-datapool-items");
      if (!data) return;
      const { taskImageIds, imageIds, folderPaths, source } = JSON.parse(data);
      if (source === "pool") {
        await tasksApi.addImages(taskIdNum, imageIds ?? [], targetPath);
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
    [taskIdNum, refreshAll, dropItems],
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
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
      if (e.key === "Escape") clearSelection();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedCount > 0) {
        e.preventDefault();
        handleBulkRemoveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectAll, clearSelection, selectedCount, moveDialogOpen]);

  // -- DataStore 로드 --
  useEffect(() => {
    dataStoresApi
      .list(projectId)
      .then((res) => setDataStore(res.data[0] ?? null))
      .catch(() => {});
  }, [projectId]);

  // -- Pool 체크 토글 --
  const handlePoolCheckPath = useCallback(
    (path: string, checked: boolean, count: number, fileId?: number) => {
      setPoolCheckedPaths((prev) => {
        const next = new Map(prev);
        if (checked) {
          next.set(path, { count, fileId });
        } else {
          next.delete(path);
        }
        return next;
      });
    },
    [],
  );

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

  // -- Pool → Task에 추가 버튼 핸들러 --
  async function handleAddPoolToTask() {
    if (!dataStore || poolCheckedPaths.size === 0 || poolAdding) return;
    setPoolAdding(true);
    const totalCheckedImages = [...poolCheckedPaths.values()].reduce(
      (a, b) => a + b.count,
      0,
    );
    setPoolProgress({ completed: 0, total: totalCheckedImages });
    let totalAdded = 0;
    let totalMoved = 0;
    let totalFailed = 0;
    const counter = { completed: 0, total: 0 };
    const onProgress = (completed: number, total: number) => {
      setPoolProgress({ completed, total });
    };
    try {
      // 최상위 체크 항목만 추출 (하위 항목은 재귀에서 자동 처리)
      const checkedKeys = [...poolCheckedPaths.keys()];
      const topLevelChecked = checkedKeys.filter(
        (p) => !checkedKeys.some((other) => other !== p && p.startsWith(other)),
      );

      // 폴더와 파일 분리
      const folderPaths = topLevelChecked.filter((p) => p.endsWith("/"));
      const filePaths = topLevelChecked.filter((p) => !p.endsWith("/"));

      // 개별 파일 추가
      if (filePaths.length > 0) {
        const fileIds = filePaths
          .map((p) => poolCheckedPaths.get(p)?.fileId)
          .filter((id): id is number => id !== undefined);
        if (fileIds.length > 0) {
          const res = await tasksApi.addImages(taskIdNum, fileIds, currentPath);
          totalAdded += res.data.added;
        }
      }

      // 폴더 재귀 추가
      for (const poolPath of folderPaths) {
        const folderName = poolPath.replace(/\/$/, "").split("/").pop()!;
        const taskTarget = currentPath
          ? `${currentPath}${folderName}/`
          : `${folderName}/`;
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
      setPoolCheckedPaths(new Map());
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
  const toolbar = (
    <div className="mb-4 flex items-center justify-between select-none shrink-0">
      <div>
        <FolderBreadcrumb
          currentPath={currentPath}
          onNavigate={(path) => handleNavigateFolder(path ? path + "/" : "")}
        />
        <span className="text-sm text-muted-foreground">
          {contentsLoading
            ? "로딩 중..."
            : `${folders.length > 0 ? `${folders.length}개 폴더, ` : ""}${totalImages}개 이미지`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateFolderInCurrentPath}
        >
          <FolderPlus className="mr-1 h-3.5 w-3.5" />새 폴더
        </Button>
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
              className={`rounded-lg border flex flex-col min-h-0 ${poolCollapsed ? "shrink-0" : "flex-1"}`}
            >
              {!dataStore ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Data Pool이 없습니다.
                </p>
              ) : (
                <FolderTreeView
                  ref={poolTreeRef}
                  readOnly
                  checkable
                  collapsible
                  collapsed={poolCollapsed}
                  onCollapsedChange={setPoolCollapsed}
                  checkedPaths={new Set(poolCheckedPaths.keys())}
                  onCheckPath={handlePoolCheckPath}
                  fetchFolderContents={fetchPoolFolderContents}
                  fetchAllFolders={fetchPoolAllFolders}
                  rootLabel="Data Pool"
                  rootIcon={
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                  }
                  rootCount={dataStore.image_count ?? 0}
                  onRefresh={refreshPoolTree}
                />
              )}
            </div>

            {/* Task에 추가 버튼 */}
            <div className="shrink-0">
              <Button
                size="sm"
                className="w-full text-xs h-7"
                disabled={poolAdding || poolCheckedPaths.size === 0}
                onClick={handleAddPoolToTask}
              >
                {poolAdding
                  ? poolProgress
                    ? `추가 중... (${poolProgress.completed}/${poolProgress.total})`
                    : "추가 중..."
                  : "↓ Task에 추가"}
              </Button>
            </div>

            {/* Task 섹션 */}
            <div className="flex-1 rounded-lg border p-2 flex flex-col overflow-hidden min-h-0">
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
                onSelectPath={handleNavigateFolder}
                onDeleteFolder={handleDeleteFolder}
                onUpdateFolder={handleUpdateFolder}
                onCreateFolder={handleCreateFolder}
                onItemDrop={handleItemDrop}
                onRefresh={refreshAll}
              />
            </div>
          </div>

          {/* 중앙: 콘텐츠 영역 */}
          <div className="min-w-0 flex-1 flex flex-col min-h-0">
            {toolbar}
            <ContentArea
              items={items}
              contentsLoading={contentsLoading}
              previewMode={previewMode}
              selectedKeys={selectedKeys}
              hasMore={taskImages.length < totalImages}
              loadingMore={loadingMore}
              onLoadMore={loadMoreImages}
              onItemClick={handleItemClick}
              onClearSelection={clearSelection}
              hasParentItem={hasParentItem}
              onNavigateUp={currentPath ? handleNavigateUp : undefined}
              totalCount={
                folders.length + totalImages + (hasParentItem ? 1 : 0)
              }
              renderBgMenu={(close) => (
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
              )}
              renderGridItem={(item, flatIndex, isSelected) => (
                <ImageGridCard
                  key={item.key}
                  item={item as DataPoolItem}
                  flatIndex={flatIndex}
                  isSelected={isSelected}
                  selectedKeys={selectedKeys}
                  renamingFolderPath={renamingFolderPath}
                  dragOverFolderKey={dragOverFolderKey}
                  deleteLabel="제거"
                  onItemClick={handleItemClick}
                  onCheckboxClick={toggleItem}
                  onNavigateFolder={handleNavigateFolder}
                  onRenameFolder={(path) => setRenamingFolderPath(path)}
                  onFinishRenameFolder={handleFinishRenameInViewer}
                  onCancelRenameFolder={() => setRenamingFolderPath(null)}
                  onMoveSelected={() => setMoveDialogOpen(true)}
                  onDeleteSelected={handleBulkRemove}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteImage={handleRemoveImage}
                  onContextMenu={(_contextItem, index) => {
                    handleItemClick(
                      index,
                      new MouseEvent("click") as unknown as React.MouseEvent,
                    );
                  }}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onFolderDragOver={handleFolderDragOver}
                  onFolderDragLeave={handleFolderDragLeave}
                  onFolderDrop={handleFolderDrop}
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
                  selectedKeys={selectedKeys}
                  renamingFolderPath={renamingFolderPath}
                  dragOverFolderKey={dragOverFolderKey}
                  deleteLabel="제거"
                  onItemClick={handleItemClick}
                  onCheckboxClick={toggleItem}
                  onNavigateFolder={handleNavigateFolder}
                  onRenameFolder={(path) => setRenamingFolderPath(path)}
                  onFinishRenameFolder={handleFinishRenameInViewer}
                  onCancelRenameFolder={() => setRenamingFolderPath(null)}
                  onMoveSelected={() => setMoveDialogOpen(true)}
                  onDeleteSelected={handleBulkRemove}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteImage={handleRemoveImage}
                  onContextMenu={(_contextItem, index) => {
                    handleItemClick(
                      index,
                      new MouseEvent("click") as unknown as React.MouseEvent,
                    );
                  }}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onFolderDragOver={handleFolderDragOver}
                  onFolderDragLeave={handleFolderDragLeave}
                  onFolderDrop={handleFolderDrop}
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
                    이 Task에 항목이 없습니다.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    좌측 Data Pool에서 항목을 추가하세요.
                  </p>
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

      {/* 이동 대상 폴더 선택 — Task용 간단 모달 */}
      {moveDialogOpen && (
        <TaskFolderMoveDialog
          taskId={taskIdNum}
          open={moveDialogOpen}
          excludePaths={selectedFolderPaths}
          onClose={() => setMoveDialogOpen(false)}
          onSelect={(targetFolder) => {
            bulkMoveMutation.mutate({
              taskImageIds: selectedTaskImageIds,
              folderPaths: selectedFolderPaths,
              targetFolder,
            });
          }}
        />
      )}

      {confirmDialog}
    </div>
  );
}

// -- Task 폴더 이동 다이얼로그 (간단 구현) --

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TaskFolderMoveDialogProps {
  taskId: number;
  open: boolean;
  excludePaths: string[];
  onClose: () => void;
  onSelect: (targetFolder: string) => void;
}

function TaskFolderMoveDialog({
  taskId,
  open,
  excludePaths,
  onClose,
  onSelect,
}: TaskFolderMoveDialogProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!open) return;
    tasksApi.getAllFolders(taskId).then((res) => {
      setFolders(
        res.data.filter((p) => !excludePaths.some((ex) => p.startsWith(ex))),
      );
    });
  }, [open, taskId, excludePaths]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>이동할 폴더 선택</DialogTitle>
        </DialogHeader>
        <div className="max-h-60 overflow-y-auto space-y-1 py-2">
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 rounded text-sm ${selected === "" ? "bg-accent font-medium" : "hover:bg-accent"}`}
            onClick={() => setSelected("")}
          >
            / (루트)
          </button>
          {folders.map((f) => (
            <button
              key={f}
              type="button"
              className={`w-full text-left px-3 py-1.5 rounded text-sm ${selected === f ? "bg-accent font-medium" : "hover:bg-accent"}`}
              onClick={() => setSelected(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={() => {
              onSelect(selected);
              onClose();
            }}
          >
            이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
