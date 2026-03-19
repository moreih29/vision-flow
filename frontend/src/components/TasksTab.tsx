import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Images, Tag, Trash2 } from 'lucide-react'
import { useTasks, useCreateTask, useDeleteTask } from '@/hooks/use-tasks'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import type { Task, TaskType } from '@/types/task'
import { TASK_LABELS, TASK_COLORS } from '@/types/task'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'

interface TasksTabProps {
  projectId: number
}

const TASK_TYPES: TaskType[] = [
  'classification',
  'object_detection',
  'instance_segmentation',
  'pose_estimation',
]

export default function TasksTab({ projectId }: TasksTabProps) {
  const navigate = useNavigate()
  const { confirmDialog, confirm, showAlert } = useConfirmDialog()

  const { data: tasks = [], isLoading, isError } = useTasks(projectId)
  const createTask = useCreateTask(projectId)
  const deleteTask = useDeleteTask(projectId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTaskType, setNewTaskType] = useState<TaskType>('classification')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const deletingRef = useRef<number | null>(null)

  async function handleCreate() {
    if (!newName.trim() || creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    try {
      await createTask.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        task_type: newTaskType,
      })
      setDialogOpen(false)
      setNewName('')
      setNewDesc('')
      setNewTaskType('classification')
    } catch {
      await showAlert({ title: '태스크 생성에 실패했습니다.' })
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  async function handleDelete(task: Task) {
    if (deletingRef.current === task.id) return
    const confirmed = await confirm({
      title: `"${task.name}" 태스크를 삭제하시겠습니까?`,
      description: '태스크에 포함된 라벨링 데이터가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return
    deletingRef.current = task.id
    try {
      await deleteTask.mutateAsync(task.id)
    } catch {
      await showAlert({ title: '태스크 삭제에 실패했습니다.' })
    } finally {
      deletingRef.current = null
    }
  }

  function openDialog() {
    setNewName('')
    setNewDesc('')
    setNewTaskType('classification')
    setDialogOpen(true)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          학습 목적에 맞게 이미지를 분류하고 라벨링하세요.
        </p>
        <Button size="sm" onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />새 태스크
        </Button>
      </div>

      {isError && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          태스크를 불러오지 못했습니다.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Tag className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">태스크가 없습니다</p>
          <p className="text-sm text-muted-foreground">
            태스크를 만들어 이미지를 분류하고 라벨링하세요
          </p>
          <Button size="sm" onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" />
            태스크 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() =>
                navigate(`/projects/${projectId}/tasks/${task.id}`)
              }
              onDelete={() => handleDelete(task)}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 태스크</DialogTitle>
            <DialogDescription>
              태스크 이름, 설명, Task 유형을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-name">이름 *</Label>
              <Input
                id="task-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="태스크 이름"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-desc">설명</Label>
              <Textarea
                id="task-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="태스크 설명 (선택)"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Task 유형 *</Label>
              <Select
                value={newTaskType}
                onValueChange={(v) => setNewTaskType(v as TaskType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((taskType) => (
                    <SelectItem key={taskType} value={taskType}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${TASK_COLORS[taskType]}`}
                        />
                        {TASK_LABELS[taskType]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              취소
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? '생성 중...' : '만들기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}

// --- TaskCard ---

interface TaskCardProps {
  task: Task
  onClick: () => void
  onDelete: () => void
}

function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const labelingProgress =
    task.image_count > 0
      ? Math.round((task.labeled_count / task.image_count) * 100)
      : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{task.name}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${TASK_COLORS[task.task_type]}`}
        >
          {TASK_LABELS[task.task_type]}
        </span>
      </div>

      {task.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Images className="h-3.5 w-3.5" />
          {task.image_count}개
        </span>
        <span className="flex items-center gap-1">
          <Tag className="h-3.5 w-3.5" />
          {task.class_count}개 클래스
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>라벨링 진행률</span>
            <span>{labelingProgress}%</span>
          </div>
          <Progress value={labelingProgress} className="h-1.5" />
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </button>
  )
}
