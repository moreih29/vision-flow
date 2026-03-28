import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tasksApi } from "@/api/tasks";
import type { VersionStatus } from "@/types/snapshot";

export function useTaskBulkRemove(
  taskId: number | null,
  callbacks: {
    onSuccess: () => void;
    onError: () => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskImageIds,
      folderPaths,
    }: {
      taskImageIds: number[];
      folderPaths: string[];
    }) => {
      if (!taskId) throw new Error("No task id");
      if (taskImageIds.length > 0) {
        await tasksApi.batchRemoveImages(taskId, taskImageIds);
      }
      if (folderPaths.length > 0) {
        for (const path of folderPaths) {
          await tasksApi.deleteFolder(taskId, path);
        }
      }
    },
    onMutate: () => {
      return toast.loading("삭제 중...");
    },
    onSuccess: (_data, _vars, toastId) => {
      if (typeof toastId === "string" || typeof toastId === "number") {
        toast.success("삭제되었습니다.", { id: toastId });
      }
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
        queryKey: ["task-folder-contents", taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "version-status"],
      });
      callbacks.onSuccess();
    },
    onError: (_err, _vars, toastId) => {
      if (typeof toastId === "string" || typeof toastId === "number") {
        toast.error("삭제에 실패했습니다.", { id: toastId });
      }
      callbacks.onError();
    },
  });
}

export function useTaskBulkMove(
  taskId: number | null,
  callbacks: {
    onSuccess: () => void;
    onError: () => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskImageIds,
      folderPaths,
      targetFolder,
    }: {
      taskImageIds: number[];
      folderPaths: string[];
      targetFolder: string;
    }) => {
      if (!taskId) throw new Error("No task id");
      if (taskImageIds.length > 0) {
        await tasksApi.batchMoveImages(taskId, taskImageIds, targetFolder);
      }
      if (folderPaths.length > 0) {
        for (const path of folderPaths) {
          const folderName = path.replace(/\/$/, "").split("/").pop() || path;
          const newPath = targetFolder
            ? targetFolder.replace(/\/?$/, "/") + folderName + "/"
            : folderName + "/";
          await tasksApi.updateFolder(taskId, path, newPath);
        }
      }
    },
    onMutate: () => {
      return toast.loading("이동 중...");
    },
    onSuccess: (_data, _vars, toastId) => {
      if (typeof toastId === "string" || typeof toastId === "number") {
        toast.success("이동되었습니다.", { id: toastId });
      }
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
        queryKey: ["task-folder-contents", taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "version-status"],
      });
      callbacks.onSuccess();
    },
    onError: (_err, _vars, toastId) => {
      if (typeof toastId === "string" || typeof toastId === "number") {
        toast.error("이동에 실패했습니다.", { id: toastId });
      }
      callbacks.onError();
    },
  });
}

export function useTaskDropItems(
  taskId: number | null,
  callbacks: {
    onSuccess: () => void;
    onError: () => void;
  },
) {
  const queryClient = useQueryClient();

  const mutate = useCallback(
    async (
      taskImageIds: number[],
      folderPaths: string[],
      targetPath: string,
    ) => {
      if (!taskId) return;
      const toastId = toast.loading("이동 중...");
      try {
        if (taskImageIds.length > 0) {
          await tasksApi.batchMoveImages(taskId, taskImageIds, targetPath);
        }
        if (folderPaths.length > 0) {
          for (const path of folderPaths) {
            const folderName = path.replace(/\/$/, "").split("/").pop() || path;
            const newPath = targetPath
              ? targetPath.replace(/\/?$/, "/") + folderName + "/"
              : folderName + "/";
            await tasksApi.updateFolder(taskId, path, newPath);
          }
        }
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
          queryKey: ["task-folder-contents", taskId],
        });
        queryClient.invalidateQueries({
          queryKey: ["tasks", taskId, "version-status"],
        });
        toast.success("이동되었습니다.", { id: toastId });
        callbacks.onSuccess();
      } catch {
        toast.error("이동에 실패했습니다.", { id: toastId });
        callbacks.onError();
      }
    },
    [taskId, queryClient, callbacks],
  );

  return { mutate };
}
