import { useCallback, useRef, useState } from 'react'
import { imagesApi } from '@/api/images'
import type { DataStore } from '@/types/data-store'

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg',
])

export interface UploadProgress {
  uploaded: number
  total: number
}

interface UploadJob {
  files: File[]
  folderPaths?: string[]
  targetFolder?: string
}

export function useImageUpload(
  dataStore: DataStore | null,
  currentPath: string,
  callbacks: {
    onUploadComplete: () => Promise<void>
    onDataStoreUpdate: (updater: (prev: DataStore | null) => DataStore | null) => void
    showAlert: (options: { title: string; description?: string }) => Promise<void>
  },
) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const uploadQueueRef = useRef<UploadJob[]>([])
  const isUploadingRef = useRef(false)

  const processUploadQueue = useCallback(async () => {
    if (isUploadingRef.current || !dataStore) return
    isUploadingRef.current = true

    while (uploadQueueRef.current.length > 0) {
      const job = uploadQueueRef.current[0]
      const basePath = job.targetFolder ?? currentPath
      const effectivePaths = job.folderPaths
        ? job.folderPaths.map((p) => basePath + p)
        : basePath
          ? job.files.map(() => basePath)
          : undefined

      const remainingTotal = uploadQueueRef.current.reduce(
        (sum, j) => sum + j.files.length,
        0,
      )
      setUploadProgress({ uploaded: 0, total: remainingTotal })

      try {
        const res = await imagesApi.upload(
          dataStore.id,
          job.files,
          effectivePaths,
          (uploaded) => {
            setUploadProgress({ uploaded, total: remainingTotal })
          },
        )
        callbacks.onDataStoreUpdate((prev) =>
          prev
            ? { ...prev, image_count: prev.image_count + res.data.length }
            : prev,
        )
        const warnings: string[] = []
        if (res.skipped.length > 0)
          warnings.push(`건너뜀 ${res.skipped.length}개: ${res.skipped.map((s) => s.reason).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`)
        if (res.failed.length > 0)
          warnings.push(`실패 ${res.failed.length}개: ${res.failed.slice(0, 3).map((f) => f.name).join(', ')}${res.failed.length > 3 ? ' ...' : ''}`)
        if (warnings.length > 0)
          await callbacks.showAlert({ title: '업로드 일부 완료', description: warnings.join('\n') })
      } catch {
        await callbacks.showAlert({ title: '이미지 업로드에 실패했습니다.' })
      }

      uploadQueueRef.current.shift()
      await callbacks.onUploadComplete()
    }

    isUploadingRef.current = false
    setUploadProgress(null)
  }, [dataStore, currentPath, callbacks])

  const handleUpload = useCallback(
    (files: File[], folderPaths?: string[], targetFolder?: string) => {
      uploadQueueRef.current.push({ files, folderPaths, targetFolder })
      processUploadQueue()
    },
    [processUploadQueue],
  )

  return {
    uploadProgress,
    handleUpload,
  }
}

export function isImageFile(f: File): boolean {
  if (f.type.startsWith('image/')) return true
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.has(ext)
}

export function processFiles(
  files: File[],
  handleUpload: (files: File[], folderPaths?: string[]) => void,
  folderPaths?: string[],
) {
  if (!files || files.length === 0) return
  const imageFiles = files.filter(isImageFile)
  if (imageFiles.length === 0) return
  if (folderPaths) {
    const imageFolderPaths = folderPaths.filter((_, i) =>
      isImageFile(files[i]),
    )
    handleUpload(imageFiles, imageFolderPaths)
  } else {
    handleUpload(imageFiles)
  }
}
