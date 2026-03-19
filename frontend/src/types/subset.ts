export type TaskType =
  | 'classification'
  | 'object_detection'
  | 'instance_segmentation'
  | 'pose_estimation'

export const TASK_LABELS: Record<TaskType, string> = {
  classification: '\uC774\uBBF8\uC9C0 \uBD84\uB958',
  object_detection: '\uAC1D\uCCB4 \uD0D0\uC9C0',
  instance_segmentation: '\uC778\uC2A4\uD134\uC2A4 \uBD84\uD560',
  pose_estimation: '\uC790\uC138 \uCD94\uC815',
}

export const TASK_COLORS: Record<TaskType, string> = {
  classification: 'bg-green-500',
  object_detection: 'bg-blue-500',
  instance_segmentation: 'bg-purple-500',
  pose_estimation: 'bg-orange-500',
}

export interface Subset {
  id: number
  name: string
  description: string | null
  task: TaskType
  project_id: number
  created_at: string
  updated_at: string
  image_count: number
  labeled_count: number
  class_count: number
}
