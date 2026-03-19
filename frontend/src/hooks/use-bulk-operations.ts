import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { imagesApi } from '@/api/images'
import { dataStoresApi } from '@/api/data-stores'
import type { DataStore } from '@/types/data-store'

export function useBulkDelete(
  dataStore: DataStore | null,
  callbacks: {
    onSuccess: (refreshedDataStore: DataStore) => void
    onError: () => void
  },
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      imageIds,
      folderPaths,
    }: {
      imageIds: number[]
      folderPaths: string[]
    }) => {
      if (!dataStore) throw new Error('No data store')
      if (imageIds.length > 0) {
        await imagesApi.batchDelete(imageIds)
      }
      if (folderPaths.length > 0) {
        await imagesApi.batchDeleteFolders(dataStore.id, folderPaths)
      }
      const refreshed = await dataStoresApi.get(dataStore.id)
      return refreshed.data
    },
    onSuccess: (refreshedDataStore) => {
      queryClient.invalidateQueries({
        queryKey: ['folder-contents', dataStore?.id],
      })
      callbacks.onSuccess(refreshedDataStore)
    },
    onError: () => {
      callbacks.onError()
    },
  })
}

export function useBulkMove(
  dataStore: DataStore | null,
  callbacks: {
    onSuccess: (refreshedDataStore: DataStore) => void
    onError: () => void
  },
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      imageIds,
      folderPaths,
      targetFolder,
    }: {
      imageIds: number[]
      folderPaths: string[]
      targetFolder: string
    }) => {
      if (!dataStore) throw new Error('No data store')
      if (imageIds.length > 0) {
        await imagesApi.batchMove(imageIds, targetFolder)
      }
      if (folderPaths.length > 0) {
        await imagesApi.batchMoveFolders(dataStore.id, folderPaths, targetFolder)
      }
      const refreshed = await dataStoresApi.get(dataStore.id)
      return refreshed.data
    },
    onSuccess: (refreshedDataStore) => {
      queryClient.invalidateQueries({
        queryKey: ['folder-contents', dataStore?.id],
      })
      callbacks.onSuccess(refreshedDataStore)
    },
    onError: () => {
      callbacks.onError()
    },
  })
}

export function useDropItems(
  dataStore: DataStore | null,
  callbacks: {
    onSuccess: () => void
    onError: () => void
  },
) {
  const queryClient = useQueryClient()

  const mutate = useCallback(
    async (imageIds: number[], folderPaths: string[], targetPath: string) => {
      if (!dataStore) return
      try {
        if (imageIds.length > 0) {
          await imagesApi.batchMove(imageIds, targetPath)
        }
        if (folderPaths.length > 0) {
          await imagesApi.batchMoveFolders(dataStore.id, folderPaths, targetPath)
        }
        queryClient.invalidateQueries({
          queryKey: ['folder-contents', dataStore.id],
        })
        callbacks.onSuccess()
      } catch {
        callbacks.onError()
      }
    },
    [dataStore, queryClient, callbacks],
  )

  return { mutate }
}
