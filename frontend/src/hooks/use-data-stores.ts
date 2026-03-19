import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dataStoresApi } from '@/api/data-stores'

export function useDataStores(projectId: number) {
  return useQuery({
    queryKey: ['data-stores', projectId],
    queryFn: async () => {
      const res = await dataStoresApi.list(projectId)
      return res.data
    },
  })
}

export function useCreateDataStore(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      dataStoresApi.create(projectId, data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-stores', projectId] })
    },
  })
}

export function useDeleteDataStore(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => dataStoresApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-stores', projectId] })
    },
  })
}
