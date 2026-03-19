import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { dataStoresApi } from '@/api/data-stores'
import { imagesApi } from '@/api/images'
import { tasksApi } from '@/api/tasks'
import type { DataStore } from '@/types/data-store'
import type { FolderInfo, ImageMeta } from '@/types/image'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface ImageSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  taskId: number
  existingImageIds: number[]
  onAdded: (addedIds: number[]) => void
}

interface TreeNode {
  path: string
  name: string
  image_count: number
  subfolder_count: number
  children?: TreeNode[]
  expanded: boolean
  loaded: boolean
}

export default function ImageSelectionModal({
  open,
  onOpenChange,
  projectId,
  taskId,
  existingImageIds,
  onAdded,
}: ImageSelectionModalProps) {
  const { confirmDialog, showAlert } = useConfirmDialog()
  const [dataStore, setDataStore] = useState<DataStore | null>(null)
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [images, setImages] = useState<ImageMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedIds([])
      setSelectedPath('')
      setTreeNodes([])
      setImages([])
      initDataStore()
    }
  }, [open, projectId])

  useEffect(() => {
    if (dataStore && open) {
      fetchImages(selectedPath)
    }
  }, [dataStore?.id, selectedPath, open])

  async function initDataStore() {
    setLoading(true)
    try {
      const res = await dataStoresApi.list(projectId)
      if (res.data.length > 0) {
        const ds = res.data[0]
        setDataStore(ds)
        await loadRootFolders(ds.id)
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }

  async function loadRootFolders(dataStoreId: number) {
    try {
      const res = await imagesApi.getFolderContents(dataStoreId, '')
      const nodes: TreeNode[] = res.data.folders.map((f: FolderInfo) => ({
        path: f.path,
        name: f.name,
        image_count: f.image_count,
        subfolder_count: f.subfolder_count,
        expanded: false,
        loaded: false,
      }))
      setTreeNodes(nodes)
    } catch {
      /* silently fail */
    }
  }

  async function fetchImages(path: string) {
    if (!dataStore) return
    setImagesLoading(true)
    try {
      const res = await imagesApi.getFolderContents(dataStore.id, path)
      setImages(res.data.images)
    } catch {
      /* silently fail */
    } finally {
      setImagesLoading(false)
    }
  }

  async function toggleExpand(nodePath: string) {
    if (!dataStore) return

    const updateNodes = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        if (node.path === nodePath) {
          if (!node.loaded) {
            return { ...node, expanded: true }
          }
          return { ...node, expanded: !node.expanded }
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) }
        }
        return node
      })

    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const n of nodes) {
        if (n.path === nodePath) return n
        if (n.children) {
          const found = findNode(n.children)
          if (found) return found
        }
      }
      return null
    }

    const node = findNode(treeNodes)
    if (node && !node.loaded) {
      try {
        const res = await imagesApi.getFolderContents(dataStore.id, nodePath)
        const children: TreeNode[] = res.data.folders.map(
          (f: FolderInfo) => ({
            path: f.path,
            name: f.name,
            image_count: f.image_count,
            subfolder_count: f.subfolder_count,
            expanded: false,
            loaded: false,
          }),
        )

        const loadChildren = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map((n) => {
            if (n.path === nodePath) {
              return { ...n, expanded: true, loaded: true, children }
            }
            if (n.children) {
              return { ...n, children: loadChildren(n.children) }
            }
            return n
          })

        setTreeNodes(loadChildren(treeNodes))
      } catch {
        /* silently fail */
      }
    } else {
      setTreeNodes(updateNodes(treeNodes))
    }
  }

  const handleToggleImage = useCallback(
    (imageId: number) => {
      if (existingImageIds.includes(imageId)) return
      setSelectedIds((prev) =>
        prev.includes(imageId)
          ? prev.filter((id) => id !== imageId)
          : [...prev, imageId],
      )
    },
    [existingImageIds],
  )

  const handleSelectAllInFolder = () => {
    const selectableIds = images
      .filter((img) => !existingImageIds.includes(img.id))
      .map((img) => img.id)
    const allSelected = selectableIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !selectableIds.includes(id)),
      )
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...selectableIds])])
    }
  }

  async function handleAdd() {
    if (selectedIds.length === 0) return
    setAdding(true)
    try {
      await tasksApi.addImages(taskId, selectedIds)
      onAdded(selectedIds)
      onOpenChange(false)
    } catch {
      await showAlert({ title: '이미지 추가에 실패했습니다.' })
    } finally {
      setAdding(false)
    }
  }

  const selectableImages = images.filter(
    (img) => !existingImageIds.includes(img.id),
  )
  const allFolderSelected =
    selectableImages.length > 0 &&
    selectableImages.every((img) => selectedIds.includes(img.id))

  function renderTreeNode(node: TreeNode, depth: number = 0) {
    const isSelected = selectedPath === node.path
    const hasChildren = node.subfolder_count > 0

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 rounded-sm px-2 py-1 text-sm cursor-pointer hover:bg-accent ${
            isSelected ? 'bg-accent font-medium' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedPath(node.path)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="shrink-0 p-0.5 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.path)
              }}
            >
              {node.expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          {node.expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {node.image_count}
          </span>
        </div>
        {node.expanded && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pool에서 이미지 추가</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        ) : !dataStore ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Data Pool이 없습니다.
          </div>
        ) : (
          <div className="flex gap-3 flex-1 min-h-0">
            {/* Left: Tree */}
            <div className="w-[220px] shrink-0 overflow-y-auto rounded-md border p-2">
              <div
                className={`flex items-center gap-1 rounded-sm px-2 py-1 text-sm cursor-pointer hover:bg-accent ${
                  selectedPath === '' ? 'bg-accent font-medium' : ''
                }`}
                onClick={() => setSelectedPath('')}
              >
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>전체</span>
              </div>
              {treeNodes.map((node) => renderTreeNode(node))}
            </div>

            {/* Right: Images */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedPath || '/'} ({images.length}개)
                </p>
                {selectableImages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllInFolder}
                  >
                    {allFolderSelected ? '전체 해제' : '전체 선택'}
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {imagesLoading ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="aspect-square w-full rounded-md"
                      />
                    ))}
                  </div>
                ) : images.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    이 폴더에 이미지가 없습니다.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {images.map((image) => {
                      const isExisting = existingImageIds.includes(image.id)
                      const isImgSelected = selectedIds.includes(image.id)
                      return (
                        <div
                          key={image.id}
                          className={`relative flex cursor-pointer flex-col gap-1 ${
                            isExisting
                              ? 'cursor-not-allowed opacity-40'
                              : ''
                          }`}
                          onClick={() => handleToggleImage(image.id)}
                        >
                          <div
                            className={`relative overflow-hidden rounded-md border aspect-square transition-all ${
                              isImgSelected
                                ? 'border-primary ring-2 ring-primary'
                                : isExisting
                                  ? 'border-border bg-muted'
                                  : 'border-border bg-muted hover:border-primary/50'
                            }`}
                          >
                            <img
                              src={imagesApi.getFileUrl(image.id)}
                              alt={image.original_filename}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {isExisting && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                <span className="rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium">
                                  추가됨
                                </span>
                              </div>
                            )}
                            {isImgSelected && !isExisting && (
                              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                <div className="rounded-full bg-primary p-1">
                                  <svg
                                    className="h-3 w-3 text-primary-foreground"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                          <p
                            className="truncate text-xs text-muted-foreground"
                            title={image.original_filename}
                          >
                            {image.original_filename}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length > 0
              ? `${selectedIds.length}개 선택됨`
              : '이미지를 선택하세요'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adding}
            >
              취소
            </Button>
            <Button
              onClick={handleAdd}
              disabled={adding || selectedIds.length === 0}
            >
              {adding ? '추가 중...' : '추가'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  )
}
