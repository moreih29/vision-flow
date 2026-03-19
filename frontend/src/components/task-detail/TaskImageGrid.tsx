import { Images, LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import type { ImageMeta } from '@/types/image'
import { TaskImageCard } from './TaskImageCard'
import { TaskImageListView } from './TaskImageListView'

interface TaskImageGridProps {
  images: ImageMeta[]
  loading: boolean
  labelingProgress: number
  imageCount: number
  previewMode: 'grid' | 'list'
  onPreviewModeChange: (mode: 'grid' | 'list') => void
  onAddImages: () => void
  onRemoveImage: (imageId: number) => void
}

export function TaskImageGrid({
  images,
  loading,
  labelingProgress,
  imageCount,
  previewMode,
  onPreviewModeChange,
  onAddImages,
  onRemoveImage,
}: TaskImageGridProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">이미지</h2>
          {imageCount > 0 && (
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
              onClick={() => onPreviewModeChange('grid')}
              title="격자 보기"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onPreviewModeChange('list')}
              title="리스트 보기"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={onAddImages}>
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
          <Button size="sm" onClick={onAddImages}>
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
              onRemove={() => onRemoveImage(image.id)}
            />
          ))}
        </div>
      ) : (
        <TaskImageListView images={images} onRemove={onRemoveImage} />
      )}
    </div>
  )
}
