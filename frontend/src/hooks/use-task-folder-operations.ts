import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/api/tasks";
import type { FolderInfo } from "@/types/image";
import type { VersionStatus } from "@/types/snapshot";

interface TaskFolderOperationsCallbacks {
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
  setCurrentPath: (path: string) => void;
  setRenamingFolderPath: (path: string | null) => void;
  invalidateFolderContents: () => Promise<void>;
  refreshTree: () => void;
}

export function useTaskFolderOperations(
  taskId: number | null,
  currentPath: string,
  folders: FolderInfo[],
  callbacks: TaskFolderOperationsCallbacks,
) {
  const queryClient = useQueryClient();

  const setDirty = useCallback(() => {
    if (!taskId) return;
    queryClient.setQueryData<VersionStatus>(
      ["tasks", taskId, "version-status"],
      (old) =>
        old
          ? {
              ...old,
              is_dirty: true,
              changes: { ...old.changes, data_changed: true },
            }
          : old,
    );
    queryClient.invalidateQueries({
      queryKey: ["tasks", taskId, "version-status"],
    });
    queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
  }, [taskId, queryClient]);

  const handleRemoveImage = useCallback(
    async (taskImageId: number) => {
      const confirmed = await callbacks.confirm({
        title: "이미지 제거",
        description: "Task에서 이미지를 제거하시겠습니까?",
        confirmLabel: "제거",
        variant: "destructive",
      });
      if (!confirmed) return;
      if (!taskId) return;
      try {
        await tasksApi.batchRemoveImages(taskId, [taskImageId]);
        setDirty();
        await callbacks.invalidateFolderContents();
        callbacks.refreshTree();
      } catch {
        await callbacks.showAlert({ title: "이미지 제거에 실패했습니다." });
      }
    },
    [taskId, callbacks, setDirty],
  );

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      if (!taskId) return;
      const folderName =
        folderPath.replace(/\/$/, "").split("/").pop() || folderPath;
      const confirmed = await callbacks.confirm({
        title: "폴더 제거",
        description: `"${folderName}" 폴더와 모든 하위 이미지를 Task에서 제거하시겠습니까?`,
        confirmLabel: "제거",
        variant: "destructive",
      });
      if (!confirmed) return;
      try {
        await tasksApi.deleteFolder(taskId, folderPath);
        setDirty();
        if (currentPath === folderPath || currentPath.startsWith(folderPath)) {
          const parts = folderPath.replace(/\/$/, "").split("/");
          parts.pop();
          callbacks.setCurrentPath(
            parts.length > 0 ? parts.join("/") + "/" : "",
          );
        } else {
          await callbacks.invalidateFolderContents();
        }
        callbacks.refreshTree();
      } catch {
        await callbacks.showAlert({ title: "폴더 제거에 실패했습니다." });
      }
    },
    [taskId, currentPath, callbacks, setDirty],
  );

  const handleCreateFolder = useCallback(
    async (folderPath: string) => {
      if (!taskId) return;
      try {
        await tasksApi.createFolder(taskId, folderPath);
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
    [taskId, callbacks],
  );

  const handleUpdateFolder = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!taskId) return;
      try {
        await tasksApi.updateFolder(taskId, oldPath, newPath);
        setDirty();
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
    [taskId, currentPath, callbacks, setDirty],
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
    handleRemoveImage,
    handleDeleteFolder,
    handleCreateFolder,
    handleUpdateFolder,
    handleCreateFolderInCurrentPath,
    handleFinishRenameInViewer,
  };
}
