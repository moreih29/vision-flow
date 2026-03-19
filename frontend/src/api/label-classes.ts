import client from '@/api/client'
import type { LabelClass } from '@/types/label-class'

export const labelClassesApi = {
  list: (subsetId: number) =>
    client.get<LabelClass[]>(`/subsets/${subsetId}/classes`),
  create: (subsetId: number, data: { name: string; color: string }) =>
    client.post<LabelClass>(`/subsets/${subsetId}/classes`, data),
  update: (id: number, data: { name?: string; color?: string }) =>
    client.put<LabelClass>(`/classes/${id}`, data),
  delete: (id: number) => client.delete(`/classes/${id}`),
}
