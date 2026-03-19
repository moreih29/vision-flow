import { useCallback, useState } from 'react'
import { isExternalFileDrag, collectEntriesAsFiles } from '@/lib/file-drop-utils'
import { processFiles } from '@/hooks/use-image-upload'

export function useExternalFileDrop(
  handleUpload: (files: File[], folderPaths?: string[], targetFolder?: string) => void,
) {
  const [isDragOverUpload, setIsDragOverUpload] = useState(false)

  const handleMainDragOver = useCallback((e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOverUpload(true)
    }
  }, [])

  const handleMainDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverUpload(false)
    }
  }, [])

  const handleMainDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      setIsDragOverUpload(false)
      if (!e.dataTransfer.items) {
        processFiles(Array.from(e.dataTransfer.files), handleUpload)
        return
      }
      const entries = Array.from(e.dataTransfer.items)
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null)
      const { files, paths } = await collectEntriesAsFiles(entries)
      if (files.length > 0) processFiles(files, handleUpload, paths)
    },
    [handleUpload],
  )

  const handleTreeExternalFileDrop = useCallback(
    async (entries: FileSystemEntry[], targetPath: string) => {
      const { files, paths } = await collectEntriesAsFiles(entries)
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      const imagePaths = paths.filter((_, i) => files[i]?.type.startsWith('image/'))
      if (imageFiles.length > 0) {
        handleUpload(imageFiles, imagePaths.length > 0 ? imagePaths : undefined, targetPath)
      }
    },
    [handleUpload],
  )

  return {
    isDragOverUpload,
    handleMainDragOver,
    handleMainDragLeave,
    handleMainDrop,
    handleTreeExternalFileDrop,
  }
}
