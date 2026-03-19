export type TaskType =
  | 'classification'
  | 'object_detection'
  | 'instance_segmentation'
  | 'pose_estimation'

export const TASK_LABELS: Record<TaskType, string> = {
  classification: '이미지 분류',
  object_detection: '객체 탐지',
  instance_segmentation: '인스턴스 분할',
  pose_estimation: '자세 추정',
}

export const TASK_COLORS: Record<TaskType, string> = {
  classification: 'bg-green-500',
  object_detection: 'bg-blue-500',
  instance_segmentation: 'bg-purple-500',
  pose_estimation: 'bg-orange-500',
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export interface Task {
  id: number
  name: string
  description: string | null
  task_type: TaskType
  status: TaskStatus
  project_id: number
  created_at: string
  updated_at: string
  image_count: number
  labeled_count: number
  class_count: number
}
