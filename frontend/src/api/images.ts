import client from '@/api/client'
import type { FolderContentsResponse, ImageMeta } from '@/types/image'

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg',
])
const MAX_BATCH_BYTES = 50 * 1024 * 1024 // 50MB per request
const MAX_BATCH_FILES = 20
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB per file
const MAX_RETRIES = 3

export interface UploadResult {
  data: ImageMeta[]
  skipped: { name: string; reason: string }[]
  failed: { name: string; error: string }[]
}

export const imagesApi = {
  list: (datasetId: number, skip?: number, limit?: number) =>
    client.get<ImageMeta[]>(`/datasets/${datasetId}/images`, {
      params: { skip, limit },
    }),

  upload: async (
    datasetId: number,
    files: File[],
    folderPaths?: string[],
    onProgress?: (uploaded: number, total: number) => void,
  ): Promise<UploadResult> => {
    const filtered: { file: File; path: string }[] = []
    const skipped: { name: string; reason: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!IMAGE_EXTS.has(ext)) continue
      if (file.size > MAX_FILE_SIZE) {
        skipped.push({
          name: file.name,
          reason: `파일 크기 초과 (${(file.size / 1024 / 1024).toFixed(1)}MB > 100MB)`,
        })
        continue
      }
      filtered.push({ file, path: folderPaths?.[i] ?? '' })
    }
    if (filtered.length === 0) return { data: [], skipped, failed: [] }

    // 파일 크기 기반 적응형 배치 분할
    const batches: { file: File; path: string }[][] = []
    let currentBatch: { file: File; path: string }[] = []
    let currentBytes = 0
    for (const item of filtered) {
      if (
        currentBatch.length >= MAX_BATCH_FILES ||
        (currentBatch.length > 0 && currentBytes + item.file.size > MAX_BATCH_BYTES)
      ) {
        batches.push(currentBatch)
        currentBatch = []
        currentBytes = 0
      }
      currentBatch.push(item)
      currentBytes += item.file.size
    }
    if (currentBatch.length > 0) batches.push(currentBatch)

    const allResults: ImageMeta[] = []
    const failedBatches: { file: File; path: string }[][] = []
    let uploaded = 0

    for (const batch of batches) {
      try {
        const res = await uploadBatch(datasetId, batch)
        allResults.push(...res)
      } catch {
        failedBatches.push(batch)
      }
      uploaded += batch.length
      onProgress?.(uploaded, filtered.length)
    }

    // 실패한 배치 재시도 (최대 MAX_RETRIES회)
    const permanentlyFailed: { name: string; error: string }[] = []
    let retryQueue = failedBatches
    for (let attempt = 1; attempt <= MAX_RETRIES && retryQueue.length > 0; attempt++) {
      const stillFailing: { file: File; path: string }[][] = []
      for (const batch of retryQueue) {
        try {
          const res = await uploadBatch(datasetId, batch)
          allResults.push(...res)
        } catch {
          if (attempt === MAX_RETRIES) {
            batch.forEach(({ file }) =>
              permanentlyFailed.push({ name: file.name, error: `${MAX_RETRIES}회 재시도 후 실패` }),
            )
          } else {
            stillFailing.push(batch)
          }
        }
      }
      retryQueue = stillFailing
    }

    return { data: allResults, skipped, failed: permanentlyFailed }
  },

  getFolderContents: (
    datasetId: number,
    path?: string,
    skip?: number,
    limit?: number,
  ) =>
    client.get<FolderContentsResponse>(`/datasets/${datasetId}/folders`, {
      params: {
        path: path ?? '',
        ...(skip !== undefined && { skip }),
        ...(limit !== undefined && { limit }),
      },
    }),

  delete: (id: number) => client.delete(`/images/${id}`),

  deleteFolder: (datasetId: number, path: string) =>
    client.delete<{ deleted_count: number }>(`/datasets/${datasetId}/folders`, {
      params: { path },
    }),

  updateFolder: (datasetId: number, oldPath: string, newPath: string) =>
    client.patch<{ updated_count: number }>(
      `/datasets/${datasetId}/folders`,
      { old_path: oldPath, new_path: newPath },
    ),

  getAllFolders: (datasetId: number) =>
    client.get<string[]>(`/datasets/${datasetId}/folders/tree`),

  createFolder: (datasetId: number, path: string) =>
    client.post<{ path: string }>(`/datasets/${datasetId}/folders`, { path }),

  batchDelete: (imageIds: number[]) =>
    client.post<{ deleted_count: number }>('/images/batch-delete', {
      image_ids: imageIds,
    }),

  batchMove: (imageIds: number[], targetFolder: string) =>
    client.patch<{ updated_count: number }>('/images/batch-move', {
      image_ids: imageIds,
      target_folder: targetFolder,
    }),

  batchDeleteFolders: (datasetId: number, paths: string[]) =>
    client.post<{ deleted_count: number }>(
      `/datasets/${datasetId}/folders/batch-delete`,
      { paths },
    ),

  batchMoveFolders: (
    datasetId: number,
    paths: string[],
    targetFolder: string,
  ) =>
    client.patch<{ updated_count: number }>(
      `/datasets/${datasetId}/folders/batch-move`,
      { paths, target_folder: targetFolder },
    ),

  getFileUrl: (id: number) => {
    const token = localStorage.getItem('auth_token')
    return `/api/v1/images/${id}/file?token=${token ?? ''}`
  },
}

async function uploadBatch(
  datasetId: number,
  batch: { file: File; path: string }[],
): Promise<ImageMeta[]> {
  const formData = new FormData()
  const paths: string[] = []
  batch.forEach(({ file, path }) => {
    formData.append('files', file)
    paths.push(path)
  })
  if (paths.some((p) => p !== '')) {
    formData.append('folder_paths', paths.join(','))
  }
  const res = await client.post<ImageMeta[]>(
    `/datasets/${datasetId}/images`,
    formData,
    { timeout: 5 * 60 * 1000 },
  )
  return res.data
}
