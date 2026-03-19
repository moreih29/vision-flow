import client from '@/api/client'
import type { Task, TaskType } from '@/types/task'

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
}
