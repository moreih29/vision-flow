import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { imagesApi } from '@/api/images'
import type { ImageMeta } from '@/types/image'

interface ImageGridProps {
  images: ImageMeta[]
  onDelete: (id: number) => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImageGrid({ images, onDelete }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          아직 이미지가 없습니다.
        </p>
        <p className="text-xs text-muted-foreground">
          위 업로드 영역에서 이미지를 추가하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {images.map((image) => (
        <div key={image.id} className="group relative flex flex-col gap-1">
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
              onClick={() => onDelete(image.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <p
            className="truncate text-xs font-medium"
            title={image.original_filename}
          >
            {image.original_filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(image.file_size)}
            {image.width && image.height
              ? ` \u00b7 ${image.width}\u00d7${image.height}`
              : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
