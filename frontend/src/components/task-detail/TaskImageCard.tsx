import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { imagesApi } from '@/api/images'
import type { ImageMeta } from '@/types/image'

interface TaskImageCardProps {
  image: ImageMeta
  onRemove: () => void
}

export function TaskImageCard({ image, onRemove }: TaskImageCardProps) {
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
      <p className="truncate text-xs font-medium" title={image.original_filename}>
        {image.original_filename}
      </p>
    </div>
  )
}
