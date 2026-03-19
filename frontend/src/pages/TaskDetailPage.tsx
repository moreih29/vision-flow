import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Images,
  Tag,
  LayoutGrid,
  List,
} from 'lucide-react'
import { tasksApi } from '@/api/tasks'
import { labelClassesApi } from '@/api/label-classes'
import { imagesApi } from '@/api/images'
import type { Task } from '@/types/task'
import { TASK_LABELS, TASK_COLORS } from '@/types/task'
import type { LabelClass } from '@/types/label-class'
import type { ImageMeta } from '@/types/image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import ImageSelectionModal from '@/components/ImageSelectionModal'

export default function TaskDetailPage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>()
  const navigate = useNavigate()
  const projectId = Number(id)
  const taskIdNum = Number(taskId)
  const { confirmDialog, confirm, showAlert } = useConfirmDialog()

  const [task, setTask] = useState<Task | null>(null)
  const [images, setImages] = useState<ImageMeta[]>([])
  const [classes, setClasses] = useState<LabelClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addImageModalOpen, setAddImageModalOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'grid' | 'list'>(() => {
    return (
      (localStorage.getItem('task_preview_mode') as 'grid' | 'list') ||
      'grid'
    )
  })

  const [addingClass, setAddingClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassColor, setNewClassColor] = useState('#3b82f6')
  const [savingClass, setSavingClass] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [taskIdNum])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [taskRes, classesRes, imagesRes] = await Promise.all([
        tasksApi.get(taskIdNum),
        labelClassesApi.list(taskIdNum),
        tasksApi.getImages(taskIdNum),
      ])
      setTask(taskRes.data)
      setClasses(classesRes.data)
      const rawImages =
        (
          imagesRes.data as {
            images?: { image: ImageMeta; image_id: number }[]
          }
        ).images ??
        (imagesRes.data as { image: ImageMeta; image_id: number }[])
      setImages(rawImages.map((si: { image: ImageMeta }) => si.image))
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveImage(imageId: number) {
    const confirmed = await confirm({
      title: '이미지 제거',
      description: '이 이미지를 태스크에서 제거하시겠습니까?',
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await tasksApi.removeImages(taskIdNum, [imageId])
      setImages((prev) => prev.filter((img) => img.id !== imageId))
      setTask((prev) =>
        prev
          ? { ...prev, image_count: Math.max(0, prev.image_count - 1) }
          : prev,
      )
    } catch {
      await showAlert({ title: '이미지 제거에 실패했습니다.' })
    }
  }

  async function handleAddClass() {
    if (!newClassName.trim()) return
    setSavingClass(true)
    try {
      const res = await labelClassesApi.create(taskIdNum, {
        name: newClassName.trim(),
        color: newClassColor,
      })
      setClasses((prev) => [...prev, res.data])
      setTask((prev) =>
        prev ? { ...prev, class_count: prev.class_count + 1 } : prev,
      )
      setNewClassName('')
      setNewClassColor('#3b82f6')
      setAddingClass(false)
    } catch {
      await showAlert({ title: '클래스 추가에 실패했습니다.' })
    } finally {
      setSavingClass(false)
    }
  }

  async function handleDeleteClass(classId: number) {
    const confirmed = await confirm({
      title: '클래스 삭제',
      description: '클래스를 삭제하시겠습니까?',
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await labelClassesApi.delete(classId)
      setClasses((prev) => prev.filter((c) => c.id !== classId))
      setTask((prev) =>
        prev
          ? { ...prev, class_count: Math.max(0, prev.class_count - 1) }
          : prev,
      )
    } catch {
      await showAlert({ title: '클래스 삭제에 실패했습니다.' })
    }
  }

  function handleImagesAdded(addedIds: number[]) {
    tasksApi.getImages(taskIdNum).then((res) => {
      const rawImages =
        (res.data as { images?: { image: ImageMeta }[] }).images ?? []
      setImages(rawImages.map((si: { image: ImageMeta }) => si.image))
    })
    setTask((prev) =>
      prev
        ? { ...prev, image_count: prev.image_count + addedIds.length }
        : prev,
    )
  }

  const labelingProgress =
    task && task.image_count > 0
      ? Math.round((task.labeled_count / task.image_count) * 100)
      : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
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
          <Button variant="ghost" size="sm" disabled title="다음 단계에서 구현 예정">
            라벨링
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-6">
          {/* Image grid */}
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">이미지</h2>
                {task && task.image_count > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Progress value={labelingProgress} className="h-1.5 w-24" />
                    <span>라벨링 {labelingProgress}%</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-md border p-0.5">
                  <Button
                    variant={previewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setPreviewMode('grid')
                      localStorage.setItem('task_preview_mode', 'grid')
                    }}
                    title="격자 보기"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setPreviewMode('list')
                      localStorage.setItem('task_preview_mode', 'list')
                    }}
                    title="리스트 보기"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="sm" onClick={() => setAddImageModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Pool에서 추가
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-md" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Images className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">이미지가 없습니다</p>
                <p className="text-sm text-muted-foreground">
                  Data Pool에서 이미지를 추가하세요
                </p>
                <Button size="sm" onClick={() => setAddImageModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Pool에서 추가
                </Button>
              </div>
            ) : previewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {images.map((image) => (
                  <TaskImageCard
                    key={image.id}
                    image={image}
                    onRemove={() => handleRemoveImage(image.id)}
                  />
                ))}
              </div>
            ) : (
              <TaskImageListView
                images={images}
                onRemove={handleRemoveImage}
              />
            )}
          </div>

          {/* Class sidebar */}
          <div className="w-64 shrink-0">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">클래스</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAddingClass(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {addingClass && (
                <div className="mb-3 flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newClassColor}
                      onChange={(e) => setNewClassColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded border"
                    />
                    <Input
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="클래스 이름"
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddClass()
                        if (e.key === 'Escape') setAddingClass(false)
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleAddClass}
                      disabled={savingClass || !newClassName.trim()}
                    >
                      {savingClass ? '저장 중...' : '추가'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setAddingClass(false)}
                      disabled={savingClass}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : classes.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  클래스가 없습니다.
                  <br />+ 버튼으로 추가하세요.
                </p>
              ) : (
                <div className="space-y-1">
                  {classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cls.color }}
                      />
                      <span
                        className="flex-1 truncate text-sm"
                        title={cls.name}
                      >
                        {cls.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {cls.label_count}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteClass(cls.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ImageSelectionModal
        open={addImageModalOpen}
        onOpenChange={setAddImageModalOpen}
        projectId={projectId}
        taskId={taskIdNum}
        existingImageIds={images.map((img) => img.id)}
        onAdded={handleImagesAdded}
      />
      {confirmDialog}
    </div>
  )
}

// --- TaskImageCard ---

interface TaskImageCardProps {
  image: ImageMeta
  onRemove: () => void
}

function TaskImageCard({ image, onRemove }: TaskImageCardProps) {
  return (
    <div className="group relative flex flex-col gap-1">
      <div className="relative overflow-hidden rounded-md border bg-muted aspect-square">
        <img
          src={imagesApi.getFileUrl(image.id)}
          alt={image.original_filename}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
        <Button
          variant="destructive"
          size="icon"
          className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
        <div className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium">
          0개 라벨
        </div>
      </div>
      <p
        className="truncate text-xs font-medium"
        title={image.original_filename}
      >
        {image.original_filename}
      </p>
    </div>
  )
}

// --- TaskImageListView ---

interface TaskImageListViewProps {
  images: ImageMeta[]
  onRemove: (id: number) => void
}

function TaskImageListView({ images, onRemove }: TaskImageListViewProps) {
  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium w-12"></th>
            <th className="px-3 py-2 text-left font-medium">파일명</th>
            <th className="px-3 py-2 text-left font-medium w-24">크기</th>
            <th className="px-3 py-2 text-left font-medium w-28">해상도</th>
            <th className="px-3 py-2 text-center font-medium w-20">라벨</th>
            <th className="px-3 py-2 text-right font-medium w-16"></th>
          </tr>
        </thead>
        <tbody>
          {images.map((image) => (
            <tr
              key={image.id}
              className="border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-1.5">
                <img
                  src={imagesApi.getFileUrl(image.id)}
                  alt={image.original_filename}
                  className="h-10 w-10 rounded object-cover"
                  loading="lazy"
                />
              </td>
              <td className="px-3 py-1.5">
                <span
                  className="truncate block max-w-xs"
                  title={image.original_filename}
                >
                  {image.original_filename}
                </span>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {formatBytes(image.file_size)}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {image.width && image.height
                  ? `${image.width} x ${image.height}`
                  : '-'}
              </td>
              <td className="px-3 py-1.5 text-center text-muted-foreground">
                0
              </td>
              <td className="px-3 py-1.5 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(image.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
