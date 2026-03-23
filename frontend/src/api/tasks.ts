import client from "@/api/client";
import type { Task, TaskType } from "@/types/task";
import type { ImageMeta } from "@/types/image";

export const tasksApi = {
  list: (projectId: number) =>
    client.get<Task[]>(`/projects/${projectId}/tasks`),
  create: (
    projectId: number,
    data: { name: string; description?: string; task_type: TaskType },
  ) => client.post<Task>(`/projects/${projectId}/tasks`, data),
  get: (id: number) => client.get<Task>(`/tasks/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    client.put<Task>(`/tasks/${id}`, data),
  delete: (id: number) => client.delete(`/tasks/${id}`),
  addImages: (taskId: number, imageIds: number[]) =>
    client.post(`/tasks/${taskId}/images`, { image_ids: imageIds }),
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
};
