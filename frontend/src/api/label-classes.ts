import client from '@/api/client'
import type { LabelClass } from '@/types/label-class'

export const labelClassesApi = {
  list: (taskId: number) =>
    client.get<LabelClass[]>(`/tasks/${taskId}/classes`),
  create: (taskId: number, data: { name: string; color: string }) =>
    client.post<LabelClass>(`/tasks/${taskId}/classes`, data),
  update: (id: number, data: { name?: string; color?: string }) =>
    client.put<LabelClass>(`/classes/${id}`, data),
  delete: (id: number) => client.delete(`/classes/${id}`),
}
