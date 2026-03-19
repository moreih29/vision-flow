import client from '@/api/client'
import type { DataStore } from '@/types/data-store'

export const dataStoresApi = {
  list: (projectId: number) =>
    client.get<DataStore[]>(`/projects/${projectId}/data-stores`),
  create: (projectId: number, data: { name: string; description?: string }) =>
    client.post<DataStore>(`/projects/${projectId}/data-stores`, data),
  get: (id: number) => client.get<DataStore>(`/data-stores/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    client.put<DataStore>(`/data-stores/${id}`, data),
  delete: (id: number) => client.delete(`/data-stores/${id}`),
}
