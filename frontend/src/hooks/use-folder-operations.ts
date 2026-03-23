import { useCallback } from "react";
import { imagesApi } from "@/api/images";
import { dataStoresApi } from "@/api/data-stores";
import type { DataStore } from "@/types/data-store";
import type { FolderInfo } from "@/types/image";

interface FolderOperationsCallbacks {
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive";
  }) => Promise<boolean>;
  showAlert: (options: {
    title: string;
    description?: string;
  }) => Promise<void>;
  setDataStore: (updater: (prev: DataStore | null) => DataStore | null) => void;
  setCurrentPath: (path: string) => void;
  setRenamingFolderPath: (path: string | null) => void;
  invalidateFolderContents: () => Promise<void>;
  refreshTree: () => void;
}

export function useFolderOperations(
  dataStore: DataStore | null,
  currentPath: string,
  folders: FolderInfo[],
  callbacks: FolderOperationsCallbacks,
) {
  const handleDeleteImage = useCallback(
    async (imageId: number) => {
      const confirmed = await callbacks.confirm({
        title: "이미지 삭제",
        description: "이미지를 삭제하시겠습니까?",
        confirmLabel: "삭제",
        variant: "destructive",
      });
      if (!confirmed) return;
      try {
        await imagesApi.delete(imageId);
        await callbacks.invalidateFolderContents();
        callbacks.setDataStore((prev) =>
          prev
            ? { ...prev, image_count: Math.max(0, prev.image_count - 1) }
            : prev,
        );
        callbacks.refreshTree();
      } catch {
        await callbacks.showAlert({ title: "이미지 삭제에 실패했습니다." });
      }
    },
    [callbacks],
  );

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      if (!dataStore) return;
      const folderName =
        folderPath.replace(/\/$/, "").split("/").pop() || folderPath;
      const confirmed = await callbacks.confirm({
        title: "폴더 삭제",
        description: `"${folderName}" 폴더와 모든 하위 이미지를 삭제하시겠습니까?`,
        confirmLabel: "삭제",
        variant: "destructive",
      });
      if (!confirmed) return;
      try {
        await imagesApi.deleteFolder(dataStore.id, folderPath);
        if (currentPath === folderPath || currentPath.startsWith(folderPath)) {
          const parts = folderPath.replace(/\/$/, "").split("/");
          parts.pop();
          callbacks.setCurrentPath(
            parts.length > 0 ? parts.join("/") + "/" : "",
          );
        } else {
          await callbacks.invalidateFolderContents();
        }
        const refreshed = await dataStoresApi.get(dataStore.id);
        callbacks.setDataStore(() => refreshed.data);
        callbacks.refreshTree();
      } catch {
        await callbacks.showAlert({ title: "폴더 삭제에 실패했습니다." });
      }
    },
    [dataStore, currentPath, callbacks],
  );

  const handleCreateFolder = useCallback(
    async (folderPath: string) => {
      if (!dataStore) return;
      try {
        await imagesApi.createFolder(dataStore.id, folderPath);
        await callbacks.invalidateFolderContents();
      } catch (e: unknown) {
        const detail = (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        await callbacks.showAlert({
          title: detail || "폴더 생성에 실패했습니다.",
        });
        throw e;
      }
    },
    [dataStore, callbacks],
  );

  const handleUpdateFolder = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!dataStore) return;
      try {
        await imagesApi.updateFolder(dataStore.id, oldPath, newPath);
      } catch (e: unknown) {
        const detail = (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        await callbacks.showAlert({
          title: detail || "폴더 업데이트에 실패했습니다.",
        });
        throw e;
      }
      if (currentPath === oldPath) {
        callbacks.setCurrentPath(newPath);
      } else if (currentPath.startsWith(oldPath)) {
        callbacks.setCurrentPath(newPath + currentPath.slice(oldPath.length));
      } else {
        await callbacks.invalidateFolderContents();
      }
      callbacks.refreshTree();
    },
    [dataStore, currentPath, callbacks],
  );

  const handleCreateFolderInCurrentPath = useCallback(async () => {
    const baseName = "새 폴더";
    const existingNames = new Set(folders.map((f) => f.name));
    let name = baseName;
    if (existingNames.has(baseName)) {
      let i = 1;
      while (existingNames.has(`${baseName}(${i})`)) i++;
      name = `${baseName}(${i})`;
    }
    const newPath = currentPath + name + "/";
    await handleCreateFolder(newPath);
    callbacks.refreshTree();
    callbacks.setRenamingFolderPath(newPath);
  }, [currentPath, folders, handleCreateFolder, callbacks]);

  const handleFinishRenameInViewer = useCallback(
    async (oldPath: string, newName: string) => {
      callbacks.setRenamingFolderPath(null);
      const trimmed = newName.trim();
      const oldName = oldPath.replace(/\/$/, "").split("/").pop() || "";
      if (!trimmed || trimmed === oldName) return;
      if (trimmed.includes("/") || trimmed.includes("\\")) {
        await callbacks.showAlert({
          title: "폴더 이름에 / 또는 \\ 문자를 포함할 수 없습니다.",
        });
        return;
      }
      const parts = oldPath.replace(/\/$/, "").split("/");
      parts[parts.length - 1] = trimmed;
      const newPath = parts.join("/") + "/";
      await handleUpdateFolder(oldPath, newPath);
      callbacks.refreshTree();
    },
    [handleUpdateFolder, callbacks],
  );

  return {
    handleDeleteImage,
    handleDeleteFolder,
    handleCreateFolder,
    handleUpdateFolder,
    handleCreateFolderInCurrentPath,
    handleFinishRenameInViewer,
  };
}
