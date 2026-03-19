import { Folder, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FolderInfo } from '@/types/image'

interface FolderCardProps {
  folder: FolderInfo
  onClick: () => void
  onDelete: () => void
}

export default function FolderCard({
  folder,
  onClick,
  onDelete,
}: FolderCardProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Folder className="h-8 w-8 text-muted-foreground" />
        <p
          className="w-full truncate text-sm font-medium"
          title={folder.name}
        >
          {folder.name}
        </p>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            {folder.image_count}개 이미지
          </p>
          {folder.subfolder_count > 0 && (
            <p className="text-xs text-muted-foreground">
              {folder.subfolder_count}개 하위폴더
            </p>
          )}
        </div>
      </button>
      <Button
        variant="destructive"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
