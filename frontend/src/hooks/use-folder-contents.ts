import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { imagesApi } from '@/api/images'
import type { FolderInfo, ImageMeta } from '@/types/image'

const PAGE_SIZE = 50

export function useFolderContents(dataStoreId: number | undefined, path: string) {
  const queryClient = useQueryClient()
  const [extraImages, setExtraImages] = useState<ImageMeta[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const query = useQuery({
    queryKey: ['folder-contents', dataStoreId, path],
    queryFn: async () => {
      const res = await imagesApi.getFolderContents(dataStoreId!, path)
      return res.data
    },
    enabled: !!dataStoreId,
  })

  // Reset extra images when the base query data changes (new path/refetch)
  const baseImages = query.data?.images ?? []
  const allImages = query.data ? [...baseImages, ...extraImages] : []
  const folders: FolderInfo[] = query.data?.folders ?? []
  const totalImages = query.data?.total_images ?? 0

  const loadMoreImages = useCallback(async () => {
    if (!dataStoreId || loadingMore) return
    const currentCount = baseImages.length + extraImages.length
    if (currentCount >= totalImages) return
    setLoadingMore(true)
    try {
      const res = await imagesApi.getFolderContents(
        dataStoreId,
        path,
        currentCount,
        PAGE_SIZE,
      )
      setExtraImages((prev) => [...prev, ...res.data.images])
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false)
    }
  }, [dataStoreId, path, baseImages.length, extraImages.length, totalImages, loadingMore])

  const invalidate = useCallback(() => {
    setExtraImages([])
    return queryClient.invalidateQueries({
      queryKey: ['folder-contents', dataStoreId, path],
    })
  }, [queryClient, dataStoreId, path])

  const invalidateAll = useCallback(() => {
    setExtraImages([])
    return queryClient.invalidateQueries({
      queryKey: ['folder-contents', dataStoreId],
    })
  }, [queryClient, dataStoreId])

  return {
    folders,
    images: allImages,
    totalImages,
    isLoading: query.isLoading,
    loadingMore,
    loadMoreImages,
    invalidate,
    invalidateAll,
  }
}
