import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/api/tasks";

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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-folder-contents", taskId],
      });
      callbacks.onSuccess();
    },
    onError: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-folder-contents", taskId],
      });
      callbacks.onSuccess();
    },
    onError: () => {
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
        queryClient.invalidateQueries({
          queryKey: ["task-folder-contents", taskId],
        });
        callbacks.onSuccess();
      } catch {
        callbacks.onError();
      }
    },
    [taskId, queryClient, callbacks],
  );

  return { mutate };
}
