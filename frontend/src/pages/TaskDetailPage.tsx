import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FolderPlus, LayoutGrid, List, PlusCircle } from "lucide-react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { tasksApi } from "@/api/tasks";
import { labelClassesApi } from "@/api/label-classes";
import type { Task } from "@/types/task";
import type { LabelClass } from "@/types/label-class";
import type { DataPoolItem } from "@/types/image";
import { Button } from "@/components/ui/button";
import FolderBreadcrumb from "@/components/FolderBreadcrumb";
import {
  TaskDetailHeader,
  TaskClassPanel,
  TaskFolderTreeView,
  type TaskFolderTreeRef,
  PoolSidePanel,
} from "@/components/task-detail";
import { DataPoolContentArea } from "@/components/data-pool";
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
  const projectId = Number(id);
  const taskIdNum = Number(taskId);
  const { confirmDialog, confirm, showAlert } = useConfirmDialog();

  // -- Core state --
  const [task, setTask] = useState<Task | null>(null);
  const [classes, setClasses] = useState<LabelClass[]>([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [previewMode, setPreviewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_MODE_KEY) as "grid" | "list") || "grid",
  );
  const [poolPanelOpen, setPoolPanelOpen] = useState(false);
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
  const treeRef = useRef<TaskFolderTreeRef>(null);
  const handleBulkRemoveRef = useRef<() => void>(() => {});

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
  const handleDropItemsOnTree = useCallback(
    async (
      taskImageIds: number[],
      folderPaths: string[],
      targetPath: string,
    ) => {
      await dropItems.mutate(taskImageIds, folderPaths, targetPath);
    },
    [dropItems],
  );

  const handlePoolDropOnTree = useCallback(
    async (imageIds: number[], targetPath: string) => {
      await tasksApi.addImages(taskIdNum, imageIds, targetPath);
      await refreshAll();
      const res = await tasksApi.get(taskIdNum);
      setTask(res.data);
    },
    [taskIdNum, refreshAll],
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
    <div className="mb-4 flex items-center justify-between select-none">
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
          onClick={() => setPoolPanelOpen(true)}
        >
          <PlusCircle className="mr-1 h-3.5 w-3.5" />
          Pool에서 추가
        </Button>
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
    <div className="flex h-screen flex-col bg-background">
      <TaskDetailHeader
        task={task}
        loading={taskLoading}
        onBack={() => navigate(`/projects/${projectId}`)}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 min-h-0">
        {error && (
          <div className="mb-4 shrink-0 rounded-md bg-destructive/10 p-3 text-sm text-destructive select-text">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-6 min-h-0">
          {/* 좌측: 폴더 트리 */}
          <div className="w-56 shrink-0 rounded-lg border p-2 overflow-y-auto">
            <TaskFolderTreeView
              ref={treeRef}
              taskId={taskIdNum}
              rootLabel={task?.name ?? "Task"}
              rootImageCount={task?.image_count ?? 0}
              selectedPath={currentPath}
              onSelectPath={handleNavigateFolder}
              onDeleteFolder={handleDeleteFolder}
              onUpdateFolder={handleUpdateFolder}
              onCreateFolder={handleCreateFolder}
              onDropItems={handleDropItemsOnTree}
              onPoolDrop={handlePoolDropOnTree}
              onRefresh={refreshAll}
            />
          </div>

          {/* 중앙: 콘텐츠 영역 */}
          <div className="min-w-0 flex-1 flex flex-col">
            {toolbar}
            <DataPoolContentArea
              items={items}
              contentsLoading={contentsLoading}
              previewMode={previewMode}
              selectedKeys={selectedKeys}
              hasMore={taskImages.length < totalImages}
              loadingMore={loadingMore}
              currentPath={currentPath}
              renamingFolderPath={renamingFolderPath}
              isDragOverUpload={false}
              onLoadMore={loadMoreImages}
              onItemClick={handleItemClick}
              onNavigateFolder={handleNavigateFolder}
              onNavigateUp={currentPath ? handleNavigateUp : undefined}
              onDeleteImage={handleRemoveImage}
              onDeleteFolder={handleDeleteFolder}
              onCheckboxClick={toggleItem}
              onMoveSelected={() => setMoveDialogOpen(true)}
              onDeleteSelected={handleBulkRemove}
              onRenameFolder={(path) => setRenamingFolderPath(path)}
              onCreateFolderHere={handleCreateFolderInCurrentPath}
              onFinishRenameFolder={handleFinishRenameInViewer}
              onCancelRenameFolder={() => setRenamingFolderPath(null)}
              onClearSelection={clearSelection}
              onDropItemsOnFolder={async (
                imageIds,
                folderPaths,
                targetPath,
              ) => {
                // Task 컨텍스트: imageIds가 실제로는 task_image_ids
                await dropItems.mutate(imageIds, folderPaths, targetPath);
              }}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onDrop={() => {}}
              variant="task"
            />
          </div>

          {/* 우측: 클래스 패널 */}
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

      <PoolSidePanel
        open={poolPanelOpen}
        projectId={projectId}
        taskId={taskIdNum}
        targetFolderPath={currentPath}
        onImagesAdded={handleImagesAdded}
        onClose={() => setPoolPanelOpen(false)}
      />
      {confirmDialog}
    </div>
  );
}

// -- Task 폴더 이동 다이얼로그 (간단 구현) --

import {
  Dialog,
  DialogClose,
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
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
          </DialogClose>
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
