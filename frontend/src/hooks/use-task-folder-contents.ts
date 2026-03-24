import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/api/tasks";
import type { FolderInfo } from "@/types/image";
import type { TaskImageResponse } from "@/types/task-image";

const PAGE_SIZE = 50;

export function useTaskFolderContents(
  taskId: number | undefined,
  path: string,
) {
  const queryClient = useQueryClient();
  const [extraImages, setExtraImages] = useState<TaskImageResponse[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setExtraImages([]);
  }, [taskId, path]);

  const query = useQuery({
    queryKey: ["task-folder-contents", taskId, path],
    queryFn: async () => {
      const res = await tasksApi.getFolderContents(taskId!, path);
      return res.data;
    },
    enabled: !!taskId,
  });

  const baseImages = query.data?.images ?? [];
  const allImages = query.data ? [...baseImages, ...extraImages] : [];
  const folders: FolderInfo[] = query.data?.folders ?? [];
  const totalImages = query.data?.total_images ?? 0;

  const loadMoreImages = useCallback(async () => {
    if (!taskId || loadingMore) return;
    const currentCount = baseImages.length + extraImages.length;
    if (currentCount >= totalImages) return;
    setLoadingMore(true);
    try {
      const res = await tasksApi.getFolderContents(
        taskId,
        path,
        currentCount,
        PAGE_SIZE,
      );
      setExtraImages((prev) => [...prev, ...res.data.images]);
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false);
    }
  }, [
    taskId,
    path,
    baseImages.length,
    extraImages.length,
    totalImages,
    loadingMore,
  ]);

  const invalidate = useCallback(() => {
    setExtraImages([]);
    return queryClient.invalidateQueries({
      queryKey: ["task-folder-contents", taskId, path],
    });
  }, [queryClient, taskId, path]);

  const invalidateAll = useCallback(() => {
    setExtraImages([]);
    return queryClient.invalidateQueries({
      queryKey: ["task-folder-contents", taskId],
    });
  }, [queryClient, taskId]);

  return {
    folders,
    images: allImages,
    totalImages,
    isLoading: query.isLoading,
    loadingMore,
    loadMoreImages,
    invalidate,
    invalidateAll,
  };
}
