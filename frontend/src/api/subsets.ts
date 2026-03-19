import client from '@/api/client'
import type { Subset, TaskType } from '@/types/subset'

export const subsetsApi = {
  list: (projectId: number) =>
    client.get<Subset[]>(`/projects/${projectId}/subsets`),
  create: (
    projectId: number,
    data: { name: string; description?: string; task: TaskType },
  ) => client.post<Subset>(`/projects/${projectId}/subsets`, data),
  get: (id: number) => client.get<Subset>(`/subsets/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    client.put<Subset>(`/subsets/${id}`, data),
  delete: (id: number) => client.delete(`/subsets/${id}`),
  addImages: (subsetId: number, imageIds: number[]) =>
    client.post(`/subsets/${subsetId}/images`, { image_ids: imageIds }),
  removeImages: (subsetId: number, imageIds: number[]) =>
    client.delete(`/subsets/${subsetId}/images`, {
      data: { image_ids: imageIds },
    }),
  getImages: (subsetId: number, skip?: number, limit?: number) =>
    client.get(`/subsets/${subsetId}/images`, { params: { skip, limit } }),
}
