export type AnnotationType = 'classification' | 'bbox' | 'polygon' | 'keypoint'

export interface Annotation {
  id: number
  task_image_id: number
  label_class_id: number | null
  annotation_type: AnnotationType
  data: Record<string, number | number[]>
  created_at: string
  updated_at: string
}

export interface AnnotationCreate {
  label_class_id?: number | null
  annotation_type: AnnotationType
  data: Record<string, number | number[]>
}
