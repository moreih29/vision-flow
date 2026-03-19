import type { UploadProgress } from '@/hooks/use-image-upload'

interface UploadProgressBarProps {
  progress: UploadProgress
}

export default function UploadProgressBar({ progress }: UploadProgressBarProps) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{
            width: `${Math.round((progress.uploaded / progress.total) * 100)}%`,
          }}
        />
      </div>
      <span className="shrink-0 text-sm text-muted-foreground">
        {progress.uploaded}/{progress.total} 업로드 중...
      </span>
    </div>
  )
}
