import { useRef } from 'react'
import { FolderPlus, LayoutGrid, List, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FolderBreadcrumb from '@/components/FolderBreadcrumb'
import { processFiles } from '@/hooks/use-image-upload'

interface DataPoolToolbarProps {
  currentPath: string
  foldersCount: number
  totalImages: number
  contentsLoading: boolean
  previewMode: 'grid' | 'list'
  onChangePreviewMode: (mode: 'grid' | 'list') => void
  onNavigateFolder: (path: string) => void
  onCreateFolder: () => void
  onUpload: (files: File[], folderPaths?: string[]) => void
}

export default function DataPoolToolbar({
  currentPath,
  foldersCount,
  totalImages,
  contentsLoading,
  previewMode,
  onChangePreviewMode,
  onNavigateFolder,
  onCreateFolder,
  onUpload,
}: DataPoolToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    processFiles(files, onUpload)
    e.target.value = ''
  }

  function handleFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const folderPaths = files.map((f) => {
      const parts = (
        f as File & { webkitRelativePath: string }
      ).webkitRelativePath.split('/')
      return parts.slice(0, -1).join('/') + '/'
    })
    processFiles(files, onUpload, folderPaths)
    e.target.value = ''
  }

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        // @ts-expect-error non-standard attributes for folder selection
        webkitdirectory=""
        directory=""
        onChange={handleFolderInputChange}
      />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <FolderBreadcrumb
            currentPath={currentPath}
            onNavigate={(path) =>
              onNavigateFolder(path ? path + '/' : '')
            }
          />
          <span className="text-sm text-muted-foreground">
            {contentsLoading
              ? '로딩 중...'
              : `${foldersCount > 0 ? `${foldersCount}개 폴더, ` : ''}${totalImages}개 이미지`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            파일
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            폴더
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateFolder}
          >
            <FolderPlus className="mr-1 h-3.5 w-3.5" />새 폴더
          </Button>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={previewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onChangePreviewMode('grid')}
              title="격자 보기"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onChangePreviewMode('list')}
              title="리스트 보기"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
