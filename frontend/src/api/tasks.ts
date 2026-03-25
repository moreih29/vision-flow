import client from "@/api/client";
import type { Task, TaskType } from "@/types/task";
import type { ImageMeta } from "@/types/image";
import type {
  TaskFolderContentsResponse,
  TaskImageResponse,
} from "@/types/task-image";

export const tasksApi = {
  list: (projectId: number) =>
    client.get<Task[]>(`/projects/${projectId}/tasks`),
  create: (
    projectId: number,
    data: {
      name: string;
      description?: string;
      task_type: TaskType;
      classes: Array<{ name: string; color: string }>;
    },
  ) => client.post<Task>(`/projects/${projectId}/tasks`, data),
  get: (id: number) => client.get<Task>(`/tasks/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    client.put<Task>(`/tasks/${id}`, data),
  delete: (id: number) => client.delete(`/tasks/${id}`),
  addImages: (taskId: number, imageIds: number[], folderPath: string = "") =>
    client.post<{
      added: number;
      moved: number;
      skipped: number;
      images: TaskImageResponse[];
    }>(`/tasks/${taskId}/images`, {
      image_ids: imageIds,
      folder_path: folderPath,
    }),
  removeImages: (taskId: number, imageIds: number[]) =>
    client.delete(`/tasks/${taskId}/images`, {
      data: { image_ids: imageIds },
    }),
  getImages: (taskId: number, skip?: number, limit?: number) =>
    client.get(`/tasks/${taskId}/images`, { params: { skip, limit } }),
  getAllImages: async (
    taskId: number,
  ): Promise<{ image: ImageMeta; image_id: number }[]> => {
    const first = await client.get<{
      images: { image: ImageMeta; image_id: number }[];
      total: number;
      skip: number;
      limit: number;
    }>(`/tasks/${taskId}/images`, { params: { skip: 0, limit: 500 } });
    const { total, images } = first.data;
    if (images.length >= total) return images;
    const remaining: Promise<typeof first>[] = [];
    for (let skip = 500; skip < total; skip += 500) {
      remaining.push(
        client.get(`/tasks/${taskId}/images`, { params: { skip, limit: 500 } }),
      );
    }
    const results = await Promise.all(remaining);
    return [...images, ...results.flatMap((r) => r.data.images)];
  },

  // 폴더 API
  getFolderContents: (
    taskId: number,
    path: string = "",
    skip?: number,
    limit?: number,
  ) =>
    client.get<TaskFolderContentsResponse>(`/tasks/${taskId}/image-folders`, {
      params: { path, skip, limit },
    }),
  getAllFolders: (taskId: number) =>
    client.get<string[]>(`/tasks/${taskId}/image-folders/tree`),
  createFolder: (taskId: number, path: string) =>
    client.post<{ path: string }>(`/tasks/${taskId}/image-folders`, { path }),
  updateFolder: (taskId: number, oldPath: string, newPath: string) =>
    client.patch<{ updated_count: number }>(`/tasks/${taskId}/image-folders`, {
      old_path: oldPath,
      new_path: newPath,
    }),
  deleteFolder: (taskId: number, path: string) =>
    client.delete<{ removed_count: number }>(`/tasks/${taskId}/image-folders`, {
      params: { path },
    }),
  batchMoveImages: (
    taskId: number,
    taskImageIds: number[],
    targetFolder: string,
  ) =>
    client.patch<{ updated_count: number }>(
      `/tasks/${taskId}/images/batch-move`,
      { task_image_ids: taskImageIds, target_folder: targetFolder },
    ),
  batchRemoveImages: (taskId: number, taskImageIds: number[]) =>
    client.post<{ removed_count: number }>(
      `/tasks/${taskId}/images/batch-remove`,
      { task_image_ids: taskImageIds },
    ),
};
