import client from '@/api/client'
import type { Annotation, AnnotationCreate } from '@/types/annotation'

export const annotationsApi = {
  list: (taskId: number, imageId: number) =>
    client.get<Annotation[]>(`/tasks/${taskId}/images/${imageId}/labels`),
  bulkSave: (taskId: number, imageId: number, annotations: AnnotationCreate[]) =>
    client.put<{ annotations: Annotation[] }>(`/tasks/${taskId}/images/${imageId}/labels`, { annotations }),
  create: (taskId: number, imageId: number, data: AnnotationCreate) =>
    client.post<Annotation>(`/tasks/${taskId}/images/${imageId}/labels`, data),
  update: (id: number, data: { label_class_id?: number | null; data?: Record<string, number | number[]> }) =>
    client.put<Annotation>(`/labels/${id}`, data),
  delete: (id: number) => client.delete(`/labels/${id}`),
}
