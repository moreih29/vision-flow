import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Images } from "lucide-react";
import { dataStoresApi } from "@/api/data-stores";
import { imagesApi } from "@/api/images";
import type { DataStore } from "@/types/data-store";
import type { DataPoolItem } from "@/types/image";
import { useDataStores, useCreateDataStore } from "@/hooks/use-data-stores";
import { useFolderContents } from "@/hooks/use-folder-contents";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  useBulkDelete,
  useBulkMove,
  useDropItems,
} from "@/hooks/use-bulk-operations";
import { useFolderOperations } from "@/hooks/use-folder-operations";
import { useExternalFileDrop } from "@/hooks/use-external-file-drop";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import FolderTreeView, {
  type FolderTreeRef,
} from "@/components/FolderTreeView";
import FolderPickerDialog from "@/components/FolderPickerDialog";
import {
  DataPoolToolbar,
  DataPoolContentArea,
  UploadProgressBar,
} from "@/components/data-pool";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

const VIEW_MODE_KEY = "datapool_preview_mode";

interface DataPoolTabProps {
  projectId: number;
  currentPath: string;
  onPathChange: (path: string) => void;
}

export default function DataPoolTab({
  projectId,
  currentPath,
  onPathChange,
}: DataPoolTabProps) {
  // -- Core state --
  const {
    data: dataStoreList,
    isLoading: dataStoresLoading,
    isError: dataStoresError,
  } = useDataStores(projectId);
  const createDataStore = useCreateDataStore(projectId);
  const creatingRef = useRef(false);
  const [dataStore, setDataStore] = useState<DataStore | null>(null);
  const [previewMode, setPreviewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_MODE_KEY) as "grid" | "list") || "grid",
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const treeRef = useRef<FolderTreeRef>(null);
  const handleBulkDeleteRef = useRef<() => void>(() => {});
  const { confirmDialog, confirm, showAlert } = useConfirmDialog();

  const fetchFolderContents = useCallback(
    async (path: string) => {
      const res = await imagesApi.getFolderContents(dataStore?.id ?? 0, path);
      return res.data;
    },
    [dataStore?.id],
  );

  const fetchAllFolders = useCallback(async () => {
    const res = await imagesApi.getAllFolders(dataStore?.id ?? 0);
    return res.data;
  }, [dataStore?.id]);

  // -- Folder contents (React Query) --
  const {
    folders,
    images,
    totalImages,
    isLoading: contentsLoading,
    loadingMore,
    loadMoreImages,
    invalidate: invalidateFolderContents,
  } = useFolderContents(dataStore?.id, currentPath);

  const refreshAll = useCallback(async () => {
    await invalidateFolderContents();
    await treeRef.current?.refresh();
  }, [invalidateFolderContents]);

  // -- Items + selection --
  const items: DataPoolItem[] = useMemo(
    () => [
      ...(currentPath ? [{ type: "parent" as const, key: "parent:.." }] : []),
      ...folders.map((f) => ({
        type: "folder" as const,
        key: `f:${f.path}`,
        folder: f,
      })),
      ...images.map((img) => ({
        type: "image" as const,
        key: `i:${img.id}`,
        image: img,
      })),
    ],
    [folders, images, currentPath],
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
  const selectedImageIds = useMemo(
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
      setDataStore,
      setCurrentPath: onPathChange,
      setRenamingFolderPath,
      invalidateFolderContents,
      refreshTree: () => {
        treeRef.current?.refresh();
      },
    }),
    [confirm, showAlert, onPathChange, invalidateFolderContents],
  );

  const {
    handleDeleteImage,
    handleDeleteFolder,
    handleCreateFolder,
    handleUpdateFolder,
    handleCreateFolderInCurrentPath,
    handleFinishRenameInViewer,
  } = useFolderOperations(dataStore, currentPath, folders, folderOpsCallbacks);

  // -- Upload --
  const uploadCallbacks = useMemo(
    () => ({
      onUploadComplete: () => refreshAll(),
      onDataStoreUpdate: setDataStore,
      showAlert,
    }),
    [showAlert, refreshAll],
  );
  const { uploadProgress, handleUpload } = useImageUpload(
    dataStore,
    currentPath,
    uploadCallbacks,
  );

  // -- External file D&D --
  const {
    isDragOverUpload,
    handleMainDragOver,
    handleMainDragLeave,
    handleMainDrop,
    handleTreeExternalFileDrop,
  } = useExternalFileDrop(handleUpload);

  // -- Bulk operations --
  const bulkDeleteMutation = useBulkDelete(
    dataStore,
    useMemo(
      () => ({
        onSuccess: (refreshed: DataStore) => {
          setDataStore(() => refreshed);
          clearSelection();
          treeRef.current?.refresh();
        },
        onError: () => {
          showAlert({ title: "삭제에 실패했습니다." });
        },
      }),
      [clearSelection, showAlert],
    ),
  );

  const bulkMoveMutation = useBulkMove(
    dataStore,
    useMemo(
      () => ({
        onSuccess: (refreshed: DataStore) => {
          setDataStore(() => refreshed);
          setMoveDialogOpen(false);
          clearSelection();
          treeRef.current?.refresh();
        },
        onError: () => {
          showAlert({ title: "이동에 실패했습니다." });
        },
      }),
      [clearSelection, showAlert],
    ),
  );

  const dropItems = useDropItems(
    dataStore,
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

  // -- Auto-select data store (set state during render pattern) --
  if (!dataStoresLoading && !dataStoresError && dataStoreList) {
    if (dataStoreList.length > 0 && dataStore === null) {
      setDataStore(dataStoreList[0]);
    }
  }

  // -- Auto-create data store if none exists --
  useEffect(() => {
    if (dataStoresLoading || dataStoresError || !dataStoreList) return;
    if (dataStoreList.length > 0) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    createDataStore.mutate(
      { name: "Data Pool" },
      {
        onSuccess: (created) => setDataStore(created),
        onError: () => setError("데이터를 불러오지 못했습니다."),
        onSettled: () => {
          creatingRef.current = false;
        },
      },
    );
  }, [dataStoreList, dataStoresLoading, dataStoresError]); // eslint-disable-line react-hooks/exhaustive-deps

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
        handleBulkDeleteRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectAll, clearSelection, selectedCount, moveDialogOpen]);

  // -- Bulk handlers --
  async function handleBulkDelete() {
    if (!dataStore || selectedCount === 0) return;
    const confirmed = await confirm({
      title: "항목 삭제",
      description: `선택한 ${selectedCount}개 항목을 삭제하시겠습니까?`,
      confirmLabel: "삭제",
      variant: "destructive",
    });
    if (!confirmed) return;
    bulkDeleteMutation.mutate({
      imageIds: selectedImageIds,
      folderPaths: selectedFolderPaths,
    });
  }
  useEffect(() => {
    handleBulkDeleteRef.current = handleBulkDelete;
  });

  const handleDropItemsOnTree = useCallback(
    async (imageIds: number[], folderPaths: string[], targetPath: string) => {
      await dropItems.mutate(imageIds, folderPaths, targetPath);
    },
    [dropItems],
  );

  // -- Navigation --
  const handleNavigateFolder = useCallback(
    (path: string) => {
      clearSelection();
      onPathChange(path);
    },
    [clearSelection, onPathChange],
  );
  const handleNavigateUp = useCallback(() => {
    if (!currentPath) return;
    const parts = currentPath.replace(/\/$/, "").split("/");
    parts.pop();
    handleNavigateFolder(parts.length > 0 ? parts.join("/") + "/" : "");
  }, [currentPath, handleNavigateFolder]);

  const handleTreeRefresh = useCallback(async () => {
    if (!dataStore) return;
    const refreshed = await dataStoresApi.get(dataStore.id);
    setDataStore(() => refreshed.data);
    await refreshAll();
  }, [dataStore, refreshAll]);

  // -- Render --
  if (dataStoresLoading || createDataStore.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || dataStoresError) {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {error || "데이터를 불러오지 못했습니다."}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {dataStore && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary">
            <Images className="mr-1 h-3 w-3" />
            {dataStore.image_count}개
          </Badge>
          <span className="text-sm text-muted-foreground">
            {dataStore.name === "Default Pool" ? "Data Pool" : dataStore.name}
          </span>
        </div>
      )}

      {uploadProgress && <UploadProgressBar progress={uploadProgress} />}

      <div className="flex gap-4 flex-1 min-h-0">
        {dataStore && (
          <div className="w-64 shrink-0 rounded-lg border p-2 flex flex-col min-h-0">
            <FolderTreeView
              ref={treeRef}
              fetchFolderContents={fetchFolderContents}
              fetchAllFolders={fetchAllFolders}
              rootLabel={
                dataStore.name === "Default Pool" ? "Data Pool" : dataStore.name
              }
              rootImageCount={dataStore.image_count}
              selectedPath={currentPath}
              acceptDropTypes={["application/x-datapool-items"]}
              acceptFileDrop
              onSelectPath={onPathChange}
              onDeleteFolder={handleDeleteFolder}
              onUpdateFolder={handleUpdateFolder}
              onCreateFolder={handleCreateFolder}
              onDropItems={handleDropItemsOnTree}
              onRefresh={handleTreeRefresh}
              onExternalFileDrop={handleTreeExternalFileDrop}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 flex flex-col min-h-0">
          <DataPoolToolbar
            currentPath={currentPath}
            foldersCount={folders.length}
            totalImages={totalImages}
            contentsLoading={contentsLoading}
            previewMode={previewMode}
            onChangePreviewMode={(mode) => {
              setPreviewMode(mode);
              localStorage.setItem(VIEW_MODE_KEY, mode);
            }}
            onNavigateFolder={handleNavigateFolder}
            onCreateFolder={handleCreateFolderInCurrentPath}
            onUpload={handleUpload}
          />
          <DataPoolContentArea
            items={items}
            contentsLoading={contentsLoading}
            previewMode={previewMode}
            selectedKeys={selectedKeys}
            hasMore={images.length < totalImages}
            loadingMore={loadingMore}
            currentPath={currentPath}
            renamingFolderPath={renamingFolderPath}
            isDragOverUpload={isDragOverUpload}
            onLoadMore={loadMoreImages}
            onItemClick={handleItemClick}
            onNavigateFolder={handleNavigateFolder}
            onNavigateUp={currentPath ? handleNavigateUp : undefined}
            onDeleteImage={handleDeleteImage}
            onDeleteFolder={handleDeleteFolder}
            onCheckboxClick={toggleItem}
            onMoveSelected={() => setMoveDialogOpen(true)}
            onDeleteSelected={handleBulkDelete}
            onRenameFolder={(path) => setRenamingFolderPath(path)}
            onCreateFolderHere={handleCreateFolderInCurrentPath}
            onFinishRenameFolder={handleFinishRenameInViewer}
            onCancelRenameFolder={() => setRenamingFolderPath(null)}
            onClearSelection={clearSelection}
            onDropItemsOnFolder={handleDropItemsOnTree}
            onDragOver={handleMainDragOver}
            onDragLeave={handleMainDragLeave}
            onDrop={handleMainDrop}
          />
        </div>
      </div>

      {dataStore && (
        <FolderPickerDialog
          dataStoreId={dataStore.id}
          open={moveDialogOpen}
          onClose={() => setMoveDialogOpen(false)}
          onSelect={(targetFolder) => {
            if (!dataStore || selectedCount === 0) return;
            bulkMoveMutation.mutate({
              imageIds: selectedImageIds,
              folderPaths: selectedFolderPaths,
              targetFolder,
            });
          }}
          excludePaths={selectedFolderPaths}
        />
      )}
      {confirmDialog}
    </div>
  );
}
