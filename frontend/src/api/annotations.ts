import client from "@/api/client";
import type { Annotation, AnnotationCreate } from "@/types/annotation";

export const annotationsApi = {
  list: (taskImageId: number) =>
    client.get<Annotation[]>(`/task-images/${taskImageId}/labels`),
  bulkSave: (taskImageId: number, annotations: AnnotationCreate[]) =>
    client.put<{ annotations: Annotation[] }>(
      `/task-images/${taskImageId}/labels`,
      { annotations },
    ),
  create: (taskImageId: number, data: AnnotationCreate) =>
    client.post<Annotation>(`/task-images/${taskImageId}/labels`, data),
  update: (
    id: number,
    data: {
      label_class_id?: number | null;
      data?: Record<string, number | number[]>;
    },
  ) => client.put<Annotation>(`/labels/${id}`, data),
  delete: (id: number) => client.delete(`/labels/${id}`),
};
