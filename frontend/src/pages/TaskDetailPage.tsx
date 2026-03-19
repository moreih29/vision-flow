import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { tasksApi } from '@/api/tasks'
import { labelClassesApi } from '@/api/label-classes'
import type { Task } from '@/types/task'
import type { LabelClass } from '@/types/label-class'
import type { ImageMeta } from '@/types/image'
import ImageSelectionModal from '@/components/ImageSelectionModal'
import {
  TaskDetailHeader,
  TaskImageGrid,
  TaskClassPanel,
} from '@/components/task-detail'

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
      (localStorage.getItem('task_preview_mode') as 'grid' | 'list') || 'grid'
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
        prev ? { ...prev, image_count: Math.max(0, prev.image_count - 1) } : prev,
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

  function handlePreviewModeChange(mode: 'grid' | 'list') {
    setPreviewMode(mode)
    localStorage.setItem('task_preview_mode', mode)
  }

  const labelingProgress =
    task && task.image_count > 0
      ? Math.round((task.labeled_count / task.image_count) * 100)
      : 0

  return (
    <div className="min-h-screen bg-background">
      <TaskDetailHeader
        task={task}
        loading={loading}
        onBack={() => navigate(`/projects/${projectId}`)}
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-6">
          <TaskImageGrid
            images={images}
            loading={loading}
            labelingProgress={labelingProgress}
            imageCount={task?.image_count ?? 0}
            previewMode={previewMode}
            onPreviewModeChange={handlePreviewModeChange}
            onAddImages={() => setAddImageModalOpen(true)}
            onRemoveImage={handleRemoveImage}
          />

          <TaskClassPanel
            classes={classes}
            loading={loading}
            addingClass={addingClass}
            newClassName={newClassName}
            newClassColor={newClassColor}
            savingClass={savingClass}
            onStartAdding={() => setAddingClass(true)}
            onCancelAdding={() => setAddingClass(false)}
            onNewClassNameChange={setNewClassName}
            onNewClassColorChange={setNewClassColor}
            onAddClass={handleAddClass}
            onDeleteClass={handleDeleteClass}
          />
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
