import client from '@/api/client'
import type { Project } from '@/types/project'

export const projectsApi = {
  list: () => client.get<Project[]>('/projects'),
  create: (data: { name: string; description?: string }) =>
    client.post<Project>('/projects', data),
  get: (id: number) => client.get<Project>(`/projects/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    client.put<Project>(`/projects/${id}`, data),
  delete: (id: number) => client.delete(`/projects/${id}`),
}
