import { ChevronRight } from 'lucide-react'

interface FolderBreadcrumbProps {
  currentPath: string
  onNavigate: (path: string) => void
}

export default function FolderBreadcrumb({
  currentPath,
  onNavigate,
}: FolderBreadcrumbProps) {
  const segments = currentPath
    ? currentPath.split('/').filter(Boolean)
    : []

  return (
    <nav className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => onNavigate('')}
        className={`transition-colors hover:text-foreground ${
          segments.length === 0
            ? 'font-medium text-foreground'
            : 'text-muted-foreground'
        }`}
      >
        전체
      </button>
      {segments.map((segment, index) => {
        const path = segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              type="button"
              onClick={() => onNavigate(path)}
              className={`transition-colors hover:text-foreground ${
                isLast
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {segment}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
