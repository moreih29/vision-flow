import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Images, Upload } from "lucide-react";
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
import {
  FileTreeView as FolderTreeView,
  type FileTreeRef as FolderTreeRef,
} from "@/components/file-tree";
import FolderPickerDialog from "@/components/FolderPickerDialog";
import {
  DataPoolToolbar,
  ImageGridCard,
  ImageListRow,
  UploadProgressBar,
} from "@/components/data-pool";
import { ContentArea } from "@/components/content-viewer";
import { ImageQuickLook } from "@/components/content-viewer/ImageQuickLook";
import { useImageDragDrop } from "@/hooks/use-image-drag-drop";
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
  const [quickLookIndex, setQuickLookIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrollToItemKey, setScrollToItemKey] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(5);
  const pendingAutoSelectPathRef = useRef<string | null>(null);
  const treeRef = useRef<FolderTreeRef>(null);
  const handleBulkDeleteRef = useRef<() => void>(() => {});
  const { confirmDialog, confirm, showAlert } = useConfirmDialog();

  const fetchFolderContents = useCallback(
    async (path: string, skip?: number, limit?: number) => {
      const res = await imagesApi.getFolderContents(
        dataStore?.id ?? 0,
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

  const imageItems = useMemo(
    () => items.filter((i) => i.type === "image"),
    [items],
  );

  const hasParentItem = items.length > 0 && items[0].type === "parent";

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

  // 폴더 진입/상위 이동 후 첫 번째 아이템 자동 선택
  // useMultiSelect 선언 이후에 위치하여 resetKey effect보다 나중에 실행되도록 보장
  useEffect(() => {
    if (pendingAutoSelectPathRef.current === null) return;
    if (pendingAutoSelectPathRef.current !== currentPath) return;
    const firstIdx = items[0]?.type === "parent" ? 1 : 0;
    if (items[firstIdx]) {
      pendingAutoSelectPathRef.current = null;
      selectByKey(items[firstIdx].key);
    }
  }, [items, currentPath, selectByKey]);
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
  });

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

  // -- Navigation --
  const handleNavigateFolder = useCallback(
    (path: string, autoSelect = false) => {
      if (autoSelect) pendingAutoSelectPathRef.current = path;
      onPathChange(path);
      if (path) treeRef.current?.expandToPath(path);
    },
    [onPathChange],
  );
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

  // -- Keyboard shortcuts --
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (moveDialogOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
      if (e.key === "Escape") clearSelection();
      if (e.key === "Delete" && selectedCount > 0) {
        e.preventDefault();
        handleBulkDeleteRef.current();
      }
      // Backspace: 상위 폴더 이동
      if (e.key === "Backspace") {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (currentPath) {
          e.preventDefault();
          handleNavigateUp(true);
        }
      }
      // Enter: 폴더 1개 선택 시 진입
      if (e.key === "Enter") {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (selectedKeys.size === 1) {
          const selectedKey = [...selectedKeys][0];
          const selectedItem = items.find((i) => i.key === selectedKey);
          if (selectedItem?.type === "folder" && selectedItem.folder) {
            e.preventDefault();
            handleNavigateFolder(selectedItem.folder.path, true);
          }
        }
      }
      if (e.key === " ") {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        // 다중 선택 시 cursor 위치의 이미지로 모달 열기
        if (selectedKeys.size > 0 && cursorIndexRef.current >= 0) {
          const cursorItem = items[cursorIndexRef.current];
          if (cursorItem?.type === "image") {
            e.preventDefault();
            const imageIndex = imageItems.findIndex(
              (i) => i.key === cursorItem.key,
            );
            if (imageIndex !== -1) setQuickLookIndex(imageIndex);
            return;
          }
        }
        const selectedImageKeys = [...selectedKeys].filter((k) =>
          k.startsWith("i:"),
        );
        if (selectedImageKeys.length === 1) {
          e.preventDefault();
          const imageIndex = imageItems.findIndex(
            (i) => i.key === selectedImageKeys[0],
          );
          if (imageIndex !== -1) setQuickLookIndex(imageIndex);
        }
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (quickLookIndex !== null) return;
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        const minIdx = items[0]?.type === "parent" ? 1 : 0;

        let currentIdx: number;
        if (e.shiftKey && selectedKeys.size > 0) {
          // Shift 모드: cursor 기준
          currentIdx =
            cursorIndexRef.current >= 0 ? cursorIndexRef.current : minIdx - 1;
        } else if (selectedKeys.size === 0) {
          currentIdx = minIdx - 1;
        } else if (cursorIndexRef.current >= 0) {
          // 다중 선택 후 일반 이동: cursor(마지막 위치) 기준
          currentIdx = cursorIndexRef.current;
        } else if (selectedKeys.size === 1) {
          const selectedKey = [...selectedKeys][0];
          currentIdx = items.findIndex((i) => i.key === selectedKey);
          if (currentIdx < 0) return;
        } else {
          return;
        }

        let nextIdx = currentIdx;
        if (previewMode === "list") {
          if (e.key === "ArrowUp") nextIdx = currentIdx - 1;
          else if (e.key === "ArrowDown") nextIdx = currentIdx + 1;
          else if (e.key === "ArrowRight") {
            // 리스트뷰: Shift 없을 때만 폴더 진입
            if (!e.shiftKey && selectedKeys.size === 1) {
              const selectedKey = [...selectedKeys][0];
              const selectedItem = items.find((i) => i.key === selectedKey);
              if (selectedItem?.type === "folder" && selectedItem.folder) {
                e.preventDefault();
                handleNavigateFolder(selectedItem.folder.path, true);
              }
            }
            return;
          } else if (e.key === "ArrowLeft") {
            // 리스트뷰: Shift 없을 때만 상위 폴더 이동
            if (!e.shiftKey && currentPath) {
              e.preventDefault();
              handleNavigateUp(true);
            }
            return;
          } else return;
        } else {
          if (e.key === "ArrowLeft") nextIdx = currentIdx - 1;
          else if (e.key === "ArrowRight") nextIdx = currentIdx + 1;
          else if (e.key === "ArrowUp") nextIdx = currentIdx - gridColumns;
          else if (e.key === "ArrowDown") nextIdx = currentIdx + gridColumns;
        }

        if (nextIdx < minIdx || nextIdx >= items.length) return;

        e.preventDefault();
        if (e.shiftKey) {
          selectTo(nextIdx);
        } else {
          const nextKey = items[nextIdx].key;
          selectByKey(nextKey);
        }
        setScrollToItemKey(items[nextIdx].key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectAll,
    clearSelection,
    selectedCount,
    moveDialogOpen,
    selectedKeys,
    imageItems,
    quickLookIndex,
    items,
    previewMode,
    gridColumns,
    selectByKey,
    selectTo,
    cursorIndexRef,
    currentPath,
    handleNavigateFolder,
    handleNavigateUp,
  ]);

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

  const handleItemDrop = useCallback(
    async (e: React.DragEvent, targetPath: string) => {
      const data = e.dataTransfer.getData("application/x-datapool-items");
      if (!data) return;
      const { imageIds, folderPaths } = JSON.parse(data);
      await dropItems.mutate(imageIds ?? [], folderPaths ?? [], targetPath);
    },
    [dropItems],
  );

  const handleFileClick = useCallback(
    (path: string, fileId?: number) => {
      if (fileId == null) return;
      const lastSlash = path.lastIndexOf("/");
      const parentPath = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "";
      const key = `i:${fileId}`;
      selectByKey(key);
      setScrollToItemKey(key);
      onPathChange(parentPath);
    },
    [onPathChange, selectByKey],
  );

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
              rootCount={dataStore.image_count}
              selectedPath={currentPath}
              acceptDropTypes={["application/x-datapool-items"]}
              acceptFileDrop
              onSelectPath={onPathChange}
              onFileClick={handleFileClick}
              onDeleteFolder={handleDeleteFolder}
              onUpdateFolder={handleUpdateFolder}
              onCreateFolder={handleCreateFolder}
              onItemDrop={handleItemDrop}
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
          <ContentArea
            items={items}
            contentsLoading={contentsLoading}
            previewMode={previewMode}
            selectedKeys={selectedKeys}
            hasMore={images.length < totalImages}
            loadingMore={loadingMore}
            onLoadMore={loadMoreImages}
            onItemClick={handleItemClick}
            onClearSelection={clearSelection}
            hasParentItem={hasParentItem}
            onNavigateUp={currentPath ? handleNavigateUp : undefined}
            totalCount={
              totalImages > 0 ? folders.length + totalImages : undefined
            }
            scrollToItemKey={scrollToItemKey}
            onScrollComplete={() => setScrollToItemKey(null)}
            onColumnsChange={(cols) => setGridColumns(cols)}
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
                onItemClick={handleItemClick}
                onCheckboxClick={toggleItem}
                onNavigateFolder={handleNavigateFolder}
                onRenameFolder={(path) => setRenamingFolderPath(path)}
                onFinishRenameFolder={handleFinishRenameInViewer}
                onCancelRenameFolder={() => setRenamingFolderPath(null)}
                onMoveSelected={() => setMoveDialogOpen(true)}
                onDeleteSelected={handleBulkDelete}
                onDeleteFolder={handleDeleteFolder}
                onDeleteImage={handleDeleteImage}
                onImageDoubleClick={(flatIdx) => {
                  const imageIndex = imageItems.findIndex(
                    (i) => i === items[flatIdx],
                  );
                  if (imageIndex !== -1) setQuickLookIndex(imageIndex);
                }}
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
            renderListItem={(item, virtualRowIndex, isSelected, virtualRow) => (
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
                onItemClick={handleItemClick}
                onCheckboxClick={toggleItem}
                onNavigateFolder={handleNavigateFolder}
                onRenameFolder={(path) => setRenamingFolderPath(path)}
                onFinishRenameFolder={handleFinishRenameInViewer}
                onCancelRenameFolder={() => setRenamingFolderPath(null)}
                onMoveSelected={() => setMoveDialogOpen(true)}
                onDeleteSelected={handleBulkDelete}
                onDeleteFolder={handleDeleteFolder}
                onDeleteImage={handleDeleteImage}
                onImageDoubleClick={(rowIdx) => {
                  const imageIndex = imageItems.findIndex(
                    (i) => i === items[rowIdx],
                  );
                  if (imageIndex !== -1) setQuickLookIndex(imageIndex);
                }}
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
                  이 폴더에 항목이 없습니다.
                </p>
                <p className="text-xs text-muted-foreground">
                  파일을 드래그하거나 상단 버튼으로 업로드하세요.
                </p>
              </div>
            )}
            fileDrop={{
              isDragOver: isDragOverUpload,
              dropLabel: currentPath
                ? `"${currentPath.replace(/\/$/, "").split("/").pop()}" 폴더에 업로드`
                : "현재 위치에 파일 업로드",
              onDragOver: handleMainDragOver,
              onDragLeave: handleMainDragLeave,
              onDrop: handleMainDrop,
            }}
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
      <ImageQuickLook
        images={imageItems.map((i) => ({
          id: i.image!.id,
          filename: i.image!.original_filename,
          width: i.image!.width ?? undefined,
          height: i.image!.height ?? undefined,
        }))}
        currentIndex={quickLookIndex ?? 0}
        open={quickLookIndex !== null}
        onOpenChange={(open) => {
          if (!open) setQuickLookIndex(null);
        }}
        onIndexChange={(idx) => {
          setQuickLookIndex(idx);
          const item = imageItems[idx];
          if (item) selectByKey(item.key);
        }}
        getImageUrl={(id) => imagesApi.getFileUrl(id)}
      />
      {confirmDialog}
    </div>
  );
}
