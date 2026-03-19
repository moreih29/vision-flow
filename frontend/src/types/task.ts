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

export type TaskStatus = 'draft' | 'labeling' | 'ready' | 'training' | 'completed'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: '준비',
  labeling: '라벨링',
  ready: '완료',
  training: '학습 중',
  completed: '학습 완료',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  draft: 'bg-gray-400',
  labeling: 'bg-yellow-500',
  ready: 'bg-green-500',
  training: 'bg-blue-500',
  completed: 'bg-emerald-600',
}

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
