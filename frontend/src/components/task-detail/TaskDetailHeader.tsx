import { ArrowLeft, Images, Tag } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Task } from '@/types/task'
import { TASK_LABELS, TASK_COLORS } from '@/types/task'

interface TaskDetailHeaderProps {
  task: Task | null
  loading: boolean
  onBack: () => void
}

export function TaskDetailHeader({ task, loading, onBack }: TaskDetailHeaderProps) {
  const navigate = useNavigate()
  const { id, taskId } = useParams<{ id: string; taskId: string }>()

  const hasImages = (task?.image_count ?? 0) > 0

  function handleLabelingClick() {
    if (!id || !taskId) return
    navigate(`/projects/${id}/tasks/${taskId}/label`)
  }

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold">{task?.name}</h1>
              {task && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${TASK_COLORS[task.task_type]}`}
                >
                  {TASK_LABELS[task.task_type]}
                </span>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Images className="h-3.5 w-3.5" />
                  {task?.image_count ?? 0}개
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  {task?.class_count ?? 0}개 클래스
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
          <Button variant="secondary" size="sm">
            목록
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasImages}
            title={hasImages ? '라벨링 시작' : '이미지를 먼저 추가하세요'}
            onClick={handleLabelingClick}
          >
            라벨링
          </Button>
        </div>
      </div>
    </>
  )
}
