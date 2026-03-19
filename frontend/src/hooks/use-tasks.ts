import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '@/api/tasks'
import type { TaskType } from '@/types/task'

export function useTasks(projectId: number) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await tasksApi.list(projectId)
      return res.data
    },
  })
}

export function useCreateTask(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      description?: string
      task_type: TaskType
    }) => tasksApi.create(projectId, data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useDeleteTask(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: number) => tasksApi.delete(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}
