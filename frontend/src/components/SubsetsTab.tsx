import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Images, Tag } from 'lucide-react'
import { subsetsApi } from '@/api/subsets'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import type { Subset, TaskType } from '@/types/subset'
import { TASK_LABELS, TASK_COLORS } from '@/types/subset'
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

interface SubsetsTabProps {
  projectId: number
}

const TASK_TYPES: TaskType[] = [
  'classification',
  'object_detection',
  'instance_segmentation',
  'pose_estimation',
]

export default function SubsetsTab({ projectId }: SubsetsTabProps) {
  const navigate = useNavigate()
  const { confirmDialog, showAlert } = useConfirmDialog()
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTask, setNewTask] = useState<TaskType>('classification')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchSubsets()
  }, [projectId])

  async function fetchSubsets() {
    setLoading(true)
    setError(null)
    try {
      const res = await subsetsApi.list(projectId)
      setSubsets(res.data)
    } catch {
      setError('\uC11C\uBE0C\uC14B\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await subsetsApi.create(projectId, {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        task: newTask,
      })
      setSubsets((prev) => [res.data, ...prev])
      setDialogOpen(false)
      setNewName('')
      setNewDesc('')
      setNewTask('classification')
    } catch {
      await showAlert({ title: '\uC11C\uBE0C\uC14B \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.' })
    } finally {
      setCreating(false)
    }
  }

  function openDialog() {
    setNewName('')
    setNewDesc('')
    setNewTask('classification')
    setDialogOpen(true)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          학습 목적에 맞게 이미지를 분류하고 라벨링하세요.
        </p>
        <Button size="sm" onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />새 서브셋
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : subsets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Tag className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">서브셋이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            서브셋을 만들어 이미지를 분류하고 라벨링하세요
          </p>
          <Button size="sm" onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" />
            서브셋 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subsets.map((subset) => (
            <SubsetCard
              key={subset.id}
              subset={subset}
              onClick={() =>
                navigate(`/projects/${projectId}/subsets/${subset.id}`)
              }
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 서브셋</DialogTitle>
            <DialogDescription>
              서브셋 이름, 설명, Task 유형을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subset-name">이름 *</Label>
              <Input
                id="subset-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="서브셋 이름"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subset-desc">설명</Label>
              <Textarea
                id="subset-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="서브셋 설명 (선택)"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Task 유형 *</Label>
              <Select
                value={newTask}
                onValueChange={(v) => setNewTask(v as TaskType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((task) => (
                    <SelectItem key={task} value={task}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${TASK_COLORS[task]}`}
                        />
                        {TASK_LABELS[task]}
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

// --- SubsetCard ---

interface SubsetCardProps {
  subset: Subset
  onClick: () => void
}

function SubsetCard({ subset, onClick }: SubsetCardProps) {
  const labelingProgress =
    subset.image_count > 0
      ? Math.round((subset.labeled_count / subset.image_count) * 100)
      : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{subset.name}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${TASK_COLORS[subset.task]}`}
        >
          {TASK_LABELS[subset.task]}
        </span>
      </div>

      {subset.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {subset.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Images className="h-3.5 w-3.5" />
          {subset.image_count}개
        </span>
        <span className="flex items-center gap-1">
          <Tag className="h-3.5 w-3.5" />
          {subset.class_count}개 클래스
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>라벨링 진행률</span>
          <span>{labelingProgress}%</span>
        </div>
        <Progress value={labelingProgress} className="h-1.5" />
      </div>
    </button>
  )
}
