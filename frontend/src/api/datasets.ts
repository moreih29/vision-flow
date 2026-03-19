import client from '@/api/client'
import type { Dataset } from '@/types/dataset'

export const datasetsApi = {
  list: (projectId: number) =>
    client.get<Dataset[]>(`/projects/${projectId}/datasets`),
  create: (projectId: number, data: { name: string; description?: string }) =>
    client.post<Dataset>(`/projects/${projectId}/datasets`, data),
  get: (id: number) => client.get<Dataset>(`/datasets/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    client.put<Dataset>(`/datasets/${id}`, data),
  delete: (id: number) => client.delete(`/datasets/${id}`),
}
