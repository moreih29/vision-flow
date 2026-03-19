import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageUploaderProps {
  onUpload: (files: File[], folderPaths?: string[]) => void | Promise<void>
  uploading: boolean
}

async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
): Promise<{ file: File; relativePath: string }[]> {
  return new Promise((resolve) => {
    const results: { file: File; relativePath: string }[] = []
    const reader = entry.createReader()

    const readEntries = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(results)
          return
        }
        for (const e of entries) {
          if (e.isFile) {
            const fileEntry = e as FileSystemFileEntry
            await new Promise<void>((res) => {
              fileEntry.file((f) => {
                results.push({ file: f, relativePath: e.fullPath.slice(1) })
                res()
              })
            })
          } else if (e.isDirectory) {
            const subResults = await readDirectoryEntry(
              e as FileSystemDirectoryEntry,
            )
            results.push(...subResults)
          }
        }
        readEntries()
      })
    }
    readEntries()
  })
}

export default function ImageUploader({
  onUpload,
  uploading,
}: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: File[], folderPaths?: string[]) => {
      if (!files || files.length === 0) return
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return
      if (folderPaths) {
        const imageFolderPaths = folderPaths.filter((_, i) =>
          files[i]?.type.startsWith('image/'),
        )
        onUpload(imageFiles, imageFolderPaths)
      } else {
        onUpload(imageFiles)
      }
    },
    [onUpload],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      handleFiles(files)
      e.target.value = ''
    },
    [handleFiles],
  )

  const handleFolderInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      const folderPaths = files.map((f) => {
        const parts = (
          f as File & { webkitRelativePath: string }
        ).webkitRelativePath.split('/')
        return parts.slice(0, -1).join('/') + '/'
      })
      handleFiles(files, folderPaths)
      e.target.value = ''
    },
    [handleFiles],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)

      const items = e.dataTransfer.items
      if (!items) {
        const files = Array.from(e.dataTransfer.files)
        handleFiles(files)
        return
      }

      const allFiles: File[] = []
      const allPaths: string[] = []

      const entries = Array.from(items)
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null)

      for (const entry of entries) {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry
          await new Promise<void>((res) => {
            fileEntry.file((f) => {
              allFiles.push(f)
              allPaths.push('')
              res()
            })
          })
        } else if (entry.isDirectory) {
          const results = await readDirectoryEntry(
            entry as FileSystemDirectoryEntry,
          )
          for (const { file, relativePath } of results) {
            allFiles.push(file)
            const parts = relativePath.split('/')
            allPaths.push(parts.slice(0, -1).join('/') + '/')
          }
        }
      }

      if (allFiles.length > 0) {
        handleFiles(allFiles, allPaths)
      }
    },
    [handleFiles],
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
      } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
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
      <Upload className="h-8 w-8 text-muted-foreground" />
      {uploading ? (
        <p className="text-sm text-muted-foreground">업로드 중...</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            파일 또는 폴더를 드래그하세요
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WEBP 등 이미지 파일 지원
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => folderInputRef.current?.click()}
            >
              폴더 선택
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
