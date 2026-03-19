import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, MousePointer, Tag, Box } from 'lucide-react'
import { Stage, Layer, Rect } from 'react-konva'
import { Button } from '@/components/ui/button'
import { tasksApi } from '@/api/tasks'
import { labelClassesApi } from '@/api/label-classes'
import type { Task } from '@/types/task'
import type { LabelClass } from '@/types/label-class'
import type { ImageMeta } from '@/types/image'
import { useLabelingStore } from '@/stores/labeling-store'

export default function LabelingPage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>()
  const navigate = useNavigate()
  const projectId = Number(id)
  const taskIdNum = Number(taskId)

  const [task, setTask] = useState<Task | null>(null)
  const [classes, setClasses] = useState<LabelClass[]>([])
  const [images, setImages] = useState<ImageMeta[]>([])
  const [loading, setLoading] = useState(true)

  const {
    tool,
    setTool,
    selectedClassId,
    setSelectedClassId,
    currentImageIndex,
    setCurrentImageIndex,
    scale,
    isDirty,
    reset,
  } = useLabelingStore()

  useEffect(() => {
    reset()
    fetchAll()
  }, [taskIdNum])

  async function fetchAll() {
    setLoading(true)
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
            images?: { image: ImageMeta }[]
          }
        ).images ?? (imagesRes.data as { image: ImageMeta }[])
      setImages(rawImages.map((si: { image: ImageMeta }) => si.image))
    } catch {
      // 에러 처리 — 빈 상태 유지
    } finally {
      setLoading(false)
    }
  }

  const totalImages = images.length
  const currentImage = images[currentImageIndex] ?? null

  function handlePrev() {
    if (currentImageIndex > 0) setCurrentImageIndex(currentImageIndex - 1)
  }

  function handleNext() {
    if (currentImageIndex < totalImages - 1)
      setCurrentImageIndex(currentImageIndex + 1)
  }

  const tools: { id: 'select' | 'classification' | 'bbox'; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: '선택', icon: <MousePointer className="h-4 w-4" /> },
    { id: 'classification', label: '분류', icon: <Tag className="h-4 w-4" /> },
    { id: 'bbox', label: '박스', icon: <Box className="h-4 w-4" /> },
  ]

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 상단 바 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/projects/${projectId}/tasks/${taskIdNum}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-semibold">
          {loading ? '로드 중...' : (task?.name ?? '라벨링')}
        </span>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* 이미지 네비게이션 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrev}
            disabled={currentImageIndex === 0 || totalImages === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[60px] text-center text-sm tabular-nums text-muted-foreground">
            {totalImages === 0 ? '0 / 0' : `${currentImageIndex + 1} / ${totalImages}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNext}
            disabled={currentImageIndex >= totalImages - 1 || totalImages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* 줌 표시 */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <ZoomIn className="h-3.5 w-3.5" />
          <span className="tabular-nums">{Math.round(scale * 100)}%</span>
        </div>

        <div className="flex-1" />

        {/* 저장 상태 */}
        <span className="text-xs text-muted-foreground">
          {isDirty ? '저장되지 않은 변경사항' : '저장됨'}
        </span>
      </header>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 패널 */}
        <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
          {/* 도구 선택 */}
          <div className="border-b p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">도구</p>
            <div className="flex flex-col gap-1">
              {tools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    tool === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 라벨 클래스 목록 */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              라벨 클래스
            </p>
            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : classes.length === 0 ? (
              <p className="text-xs text-muted-foreground">클래스가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() =>
                      setSelectedClassId(
                        selectedClassId === cls.id ? null : cls.id,
                      )
                    }
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      selectedClassId === cls.id
                        ? 'bg-accent text-accent-foreground ring-1 ring-primary'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span className="flex-1 truncate text-left">{cls.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cls.label_count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* 중앙 캔버스 영역 */}
        <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-800">
          {!loading && totalImages === 0 ? (
            <div className="flex flex-col items-center gap-2 text-neutral-400">
              <p className="text-sm">이미지가 없습니다</p>
              <p className="text-xs">태스크에 이미지를 추가하세요</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-neutral-500">
              <Stage width={800} height={600}>
                <Layer>
                  <Rect
                    x={0}
                    y={0}
                    width={800}
                    height={600}
                    fill="#404040"
                  />
                </Layer>
              </Stage>
              <p className="absolute text-xs text-neutral-400">
                캔버스 영역 {currentImage ? `— ${currentImage.original_filename}` : ''}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
