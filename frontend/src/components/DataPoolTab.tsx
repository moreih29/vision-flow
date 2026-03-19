import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderPlus, Images, LayoutGrid, List, Upload } from 'lucide-react'
import { dataStoresApi } from '@/api/data-stores'
import { imagesApi } from '@/api/images'
import type { DataStore } from '@/types/data-store'
import type { DataPoolItem, FolderInfo, ImageMeta } from '@/types/image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import VirtualImageGrid from '@/components/VirtualImageGrid'
import VirtualImageList from '@/components/VirtualImageList'
import FolderTreeView, { type FolderTreeRef } from '@/components/FolderTreeView'
import FolderBreadcrumb from '@/components/FolderBreadcrumb'
import FolderPickerDialog from '@/components/FolderPickerDialog'
import { useMultiSelect } from '@/hooks/useMultiSelect'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg',
])

// -- Helpers --

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

function isExternalFileDrag(e: React.DragEvent) {
  return (
    e.dataTransfer.types.includes('Files') &&
    !e.dataTransfer.types.includes('application/x-datapool-items')
  )
}

const VIEW_MODE_KEY = 'datapool_preview_mode'

// -- Component --

interface DataPoolTabProps {
  projectId: number
}

export default function DataPoolTab({ projectId }: DataPoolTabProps) {
  const [dataStore, setDataStore] = useState<DataStore | null>(null)
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [images, setImages] = useState<ImageMeta[]>([])
  const [totalImages, setTotalImages] = useState(0)
  const [currentPath, setCurrentPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [contentsLoading, setContentsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{
    uploaded: number
    total: number
  } | null>(null)
  const uploadQueueRef = useRef<
    { files: File[]; folderPaths?: string[]; targetFolder?: string }[]
  >([])
  const isUploadingRef = useRef(false)
  const [previewMode, setPreviewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as 'grid' | 'list') || 'grid'
  })
  const treeRef = useRef<FolderTreeRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [isDragOverUpload, setIsDragOverUpload] = useState(false)
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(
    null,
  )
  const handleBulkDeleteRef = useRef<() => void>(() => {})

  const { confirmDialog, confirm, showAlert } = useConfirmDialog()

  // -- Unified items list --

  const items: DataPoolItem[] = useMemo(
    () => [
      ...(currentPath
        ? [{ type: 'parent' as const, key: 'parent:..' }]
        : []),
      ...folders.map((f) => ({
        type: 'folder' as const,
        key: `f:${f.path}`,
        folder: f,
      })),
      ...images.map((img) => ({
        type: 'image' as const,
        key: `i:${img.id}`,
        image: img,
      })),
    ],
    [folders, images, currentPath],
  )

  const itemKeys = useMemo(() => items.map((i) => i.key), [items])
  const {
    selectedKeys,
    selectedCount,
    handleItemClick,
    toggleItem,
    clearSelection,
    selectAll,
  } = useMultiSelect(itemKeys, currentPath)

  // -- Keyboard shortcuts --

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (moveDialogOpen) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }
      if (e.key === 'Escape') {
        clearSelection()
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedCount > 0
      ) {
        e.preventDefault()
        handleBulkDeleteRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectAll, clearSelection, selectedCount, moveDialogOpen])

  // -- Selected item parsing --

  const selectedImageIds = useMemo(
    () =>
      [...selectedKeys]
        .filter((k) => k.startsWith('i:'))
        .map((k) => parseInt(k.slice(2))),
    [selectedKeys],
  )
  const selectedFolderPaths = useMemo(
    () =>
      [...selectedKeys].filter((k) => k.startsWith('f:')).map((k) => k.slice(2)),
    [selectedKeys],
  )

  // -- Data fetching --

  useEffect(() => {
    initDataStore()
  }, [projectId])

  useEffect(() => {
    if (dataStore) {
      fetchFolderContents(currentPath)
    }
  }, [dataStore?.id, currentPath])

  async function initDataStore() {
    setLoading(true)
    setError(null)
    try {
      const res = await dataStoresApi.list(projectId)
      if (res.data.length > 0) {
        setDataStore(res.data[0])
      } else {
        const created = await dataStoresApi.create(projectId, {
          name: 'Default Pool',
        })
        setDataStore(created.data)
      }
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const PAGE_SIZE = 50

  async function fetchFolderContents(path: string) {
    if (!dataStore) return
    const isInitialLoad =
      folders.length === 0 && images.length === 0 && totalImages === 0
    if (isInitialLoad) setContentsLoading(true)
    try {
      const res = await imagesApi.getFolderContents(dataStore.id, path)
      setFolders(res.data.folders)
      setImages(res.data.images)
      setTotalImages(res.data.total_images)
    } catch {
      setError('폴더 내용을 불러오지 못했습니다.')
    } finally {
      setContentsLoading(false)
    }
  }

  async function refreshAll() {
    await fetchFolderContents(currentPath)
    await treeRef.current?.refresh()
  }

  const loadMoreImages = useCallback(async () => {
    if (!dataStore || loadingMore || images.length >= totalImages) return
    setLoadingMore(true)
    try {
      const res = await imagesApi.getFolderContents(
        dataStore.id,
        currentPath,
        images.length,
        PAGE_SIZE,
      )
      setImages((prev) => [...prev, ...res.data.images])
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false)
    }
  }, [dataStore, currentPath, images.length, totalImages, loadingMore])

  // -- Upload --

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
        setDataStore((prev) =>
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
          await showAlert({ title: '업로드 일부 완료', description: warnings.join('\n') })
      } catch {
        await showAlert({ title: '이미지 업로드에 실패했습니다.' })
      }

      uploadQueueRef.current.shift()
      await refreshAll()
    }

    isUploadingRef.current = false
    setUploadProgress(null)
  }, [dataStore, currentPath])

  const handleUpload = useCallback(
    (files: File[], folderPaths?: string[], targetFolder?: string) => {
      uploadQueueRef.current.push({ files, folderPaths, targetFolder })
      processUploadQueue()
    },
    [processUploadQueue],
  )

  function isImageFile(f: File) {
    if (f.type.startsWith('image/')) return true
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    return IMAGE_EXTS.has(ext)
  }

  function processFiles(files: File[], folderPaths?: string[]) {
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

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    processFiles(files)
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
    processFiles(files, folderPaths)
    e.target.value = ''
  }

  // -- Drag & Drop (external files) --

  function handleMainDragOver(e: React.DragEvent) {
    if (isExternalFileDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOverUpload(true)
    }
  }

  function handleMainDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverUpload(false)
    }
  }

  async function handleMainDrop(e: React.DragEvent) {
    if (!isExternalFileDrag(e)) return
    e.preventDefault()
    setIsDragOverUpload(false)

    const dtItems = e.dataTransfer.items
    if (!dtItems) {
      processFiles(Array.from(e.dataTransfer.files))
      return
    }

    const allFiles: File[] = []
    const allPaths: string[] = []

    const entries = Array.from(dtItems)
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
      processFiles(allFiles, allPaths)
    }
  }

  // -- CRUD operations --

  async function handleDeleteImage(imageId: number) {
    const confirmed = await confirm({
      title: '이미지 삭제',
      description: '이미지를 삭제하시겠습니까?',
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await imagesApi.delete(imageId)
      setImages((prev) => prev.filter((img) => img.id !== imageId))
      setTotalImages((prev) => Math.max(0, prev - 1))
      setDataStore((prev) =>
        prev
          ? { ...prev, image_count: Math.max(0, prev.image_count - 1) }
          : prev,
      )
      treeRef.current?.refresh()
    } catch {
      await showAlert({ title: '이미지 삭제에 실패했습니다.' })
    }
  }

  async function handleDeleteFolder(folderPath: string) {
    if (!dataStore) return
    const folderName =
      folderPath.replace(/\/$/, '').split('/').pop() || folderPath
    const confirmed = await confirm({
      title: '폴더 삭제',
      description: `"${folderName}" 폴더와 모든 하위 이미지를 삭제하시겠습니까?`,
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await imagesApi.deleteFolder(dataStore.id, folderPath)
      if (currentPath === folderPath || currentPath.startsWith(folderPath)) {
        const parts = folderPath.replace(/\/$/, '').split('/')
        parts.pop()
        setCurrentPath(parts.length > 0 ? parts.join('/') + '/' : '')
      } else {
        await fetchFolderContents(currentPath)
      }
      const refreshed = await dataStoresApi.get(dataStore.id)
      setDataStore(refreshed.data)
      treeRef.current?.refresh()
    } catch {
      await showAlert({ title: '폴더 삭제에 실패했습니다.' })
    }
  }

  async function handleCreateFolder(folderPath: string) {
    if (!dataStore) return
    try {
      await imagesApi.createFolder(dataStore.id, folderPath)
      await fetchFolderContents(currentPath)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      await showAlert({ title: detail || '폴더 생성에 실패했습니다.' })
      throw e
    }
  }

  function generateNewFolderName() {
    const baseName = '새 폴더'
    const existingNames = new Set(folders.map((f) => f.name))
    if (!existingNames.has(baseName)) return baseName
    let i = 1
    while (existingNames.has(`${baseName}(${i})`)) i++
    return `${baseName}(${i})`
  }

  async function handleCreateFolderInCurrentPath() {
    const name = generateNewFolderName()
    const newPath = currentPath + name + '/'
    await handleCreateFolder(newPath)
    treeRef.current?.refresh()
    setRenamingFolderPath(newPath)
  }

  async function handleFinishRenameInViewer(oldPath: string, newName: string) {
    setRenamingFolderPath(null)
    const trimmed = newName.trim()
    const oldName = oldPath.replace(/\/$/, '').split('/').pop() || ''
    if (!trimmed || trimmed === oldName) return
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      await showAlert({
        title: '폴더 이름에 / 또는 \\ 문자를 포함할 수 없습니다.',
      })
      return
    }
    const parts = oldPath.replace(/\/$/, '').split('/')
    parts[parts.length - 1] = trimmed
    const newPath = parts.join('/') + '/'
    await handleUpdateFolder(oldPath, newPath)
    treeRef.current?.refresh()
  }

  function handleCancelRenameInViewer() {
    setRenamingFolderPath(null)
  }

  async function handleUpdateFolder(oldPath: string, newPath: string) {
    if (!dataStore) return
    try {
      await imagesApi.updateFolder(dataStore.id, oldPath, newPath)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      await showAlert({
        title: detail || '폴더 업데이트에 실패했습니다.',
      })
      throw e
    }
    if (currentPath === oldPath) {
      setCurrentPath(newPath)
    } else if (currentPath.startsWith(oldPath)) {
      setCurrentPath(newPath + currentPath.slice(oldPath.length))
    } else {
      await fetchFolderContents(currentPath)
    }
    treeRef.current?.refresh()
  }

  // -- Bulk operations --

  handleBulkDeleteRef.current = handleBulkDelete
  async function handleBulkDelete() {
    if (!dataStore || selectedCount === 0) return
    const confirmed = await confirm({
      title: '항목 삭제',
      description: `선택한 ${selectedCount}개 항목을 삭제하시겠습니까?`,
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return

    try {
      if (selectedImageIds.length > 0) {
        await imagesApi.batchDelete(selectedImageIds)
      }
      if (selectedFolderPaths.length > 0) {
        await imagesApi.batchDeleteFolders(dataStore.id, selectedFolderPaths)
      }
      clearSelection()
      await fetchFolderContents(currentPath)
      const refreshed = await dataStoresApi.get(dataStore.id)
      setDataStore(refreshed.data)
      treeRef.current?.refresh()
    } catch {
      await showAlert({ title: '삭제에 실패했습니다.' })
    }
  }

  async function handleBulkMove(targetFolder: string) {
    if (!dataStore || selectedCount === 0) return

    try {
      if (selectedImageIds.length > 0) {
        await imagesApi.batchMove(selectedImageIds, targetFolder)
      }
      if (selectedFolderPaths.length > 0) {
        await imagesApi.batchMoveFolders(
          dataStore.id,
          selectedFolderPaths,
          targetFolder,
        )
      }
      setMoveDialogOpen(false)
      clearSelection()
      await fetchFolderContents(currentPath)
      const refreshed = await dataStoresApi.get(dataStore.id)
      setDataStore(refreshed.data)
      treeRef.current?.refresh()
    } catch {
      await showAlert({ title: '이동에 실패했습니다.' })
    }
  }

  function handleRenameFolderFromPanel(folderPath: string) {
    setRenamingFolderPath(folderPath)
  }

  async function handleDropItemsOnTree(
    imageIds: number[],
    folderPaths: string[],
    targetPath: string,
  ) {
    if (!dataStore) return
    try {
      if (imageIds.length > 0) {
        await imagesApi.batchMove(imageIds, targetPath)
      }
      if (folderPaths.length > 0) {
        await imagesApi.batchMoveFolders(dataStore.id, folderPaths, targetPath)
      }
      clearSelection()
      await refreshAll()
    } catch {
      await showAlert({ title: '이동에 실패했습니다.' })
    }
  }

  // -- Navigation --

  function handleNavigateFolder(path: string) {
    clearSelection()
    setCurrentPath(path)
  }

  function handleNavigateUp() {
    if (!currentPath) return
    const parts = currentPath.replace(/\/$/, '').split('/')
    parts.pop()
    handleNavigateFolder(parts.length > 0 ? parts.join('/') + '/' : '')
  }

  function changePreviewMode(mode: 'grid' | 'list') {
    setPreviewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  const hasMore = images.length < totalImages

  // -- Render --

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {dataStore && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary">
            <Images className="mr-1 h-3 w-3" />
            {dataStore.image_count}개
          </Badge>
          <span className="text-sm text-muted-foreground">{dataStore.name}</span>
        </div>
      )}

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

      {/* Upload progress */}
      {uploadProgress && (
        <div className="mb-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {uploadProgress.uploaded}/{uploadProgress.total} 업로드 중...
          </span>
        </div>
      )}

      {/* Main content: left tree + right preview */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Tree */}
        {dataStore && (
          <div className="w-64 shrink-0 rounded-lg border p-2 overflow-y-auto">
            <FolderTreeView
              ref={treeRef}
              dataStoreId={dataStore.id}
              rootLabel={dataStore.name}
              rootImageCount={dataStore.image_count}
              selectedPath={currentPath}
              onSelectPath={setCurrentPath}
              onDeleteFolder={handleDeleteFolder}
              onUpdateFolder={handleUpdateFolder}
              onCreateFolder={handleCreateFolder}
              onDropItems={handleDropItemsOnTree}
              onRefresh={async () => {
                const refreshed = await dataStoresApi.get(dataStore.id)
                setDataStore(refreshed.data)
                await refreshAll()
              }}
              onExternalFileDrop={async (entries, targetPath) => {
                const allFiles: File[] = []
                const allPaths: string[] = []
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
                const imageFiles = allFiles.filter((f) =>
                  f.type.startsWith('image/'),
                )
                const imagePaths = allPaths.filter((_, i) =>
                  allFiles[i]?.type.startsWith('image/'),
                )

                if (imageFiles.length > 0) {
                  handleUpload(
                    imageFiles,
                    imagePaths.length > 0 ? imagePaths : undefined,
                    targetPath,
                  )
                }
              }}
            />
          </div>
        )}

        {/* Right: Preview */}
        <div
          className={`min-w-0 flex-1 flex flex-col relative ${isDragOverUpload ? 'ring-2 ring-primary ring-inset rounded-lg' : ''}`}
          onDragOver={handleMainDragOver}
          onDragLeave={handleMainDragLeave}
          onDrop={handleMainDrop}
        >
          {isDragOverUpload && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-primary/10 pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="h-10 w-10" />
                <p className="text-sm font-medium">
                  {currentPath
                    ? `"${currentPath.replace(/\/$/, '').split('/').pop()}" 폴더에 업로드`
                    : '현재 위치에 파일 업로드'}
                </p>
              </div>
            </div>
          )}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <FolderBreadcrumb
                currentPath={currentPath}
                onNavigate={(path) =>
                  handleNavigateFolder(path ? path + '/' : '')
                }
              />
              <span className="text-sm text-muted-foreground">
                {contentsLoading
                  ? '로딩 중...'
                  : `${folders.length > 0 ? `${folders.length}개 폴더, ` : ''}${totalImages}개 이미지`}
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
                onClick={handleCreateFolderInCurrentPath}
              >
                <FolderPlus className="mr-1 h-3.5 w-3.5" />새 폴더
              </Button>
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  variant={previewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => changePreviewMode('grid')}
                  title="격자 보기"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => changePreviewMode('list')}
                  title="리스트 보기"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {contentsLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="aspect-square w-full rounded-md"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  이 폴더에 항목이 없습니다.
                </p>
                <p className="text-xs text-muted-foreground">
                  파일을 드래그하거나 상단 버튼으로 업로드하세요.
                </p>
              </div>
            ) : previewMode === 'grid' ? (
              <VirtualImageGrid
                items={items}
                selectedKeys={selectedKeys}
                onItemClick={handleItemClick}
                onNavigateFolder={handleNavigateFolder}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMoreImages}
                onDeleteImage={handleDeleteImage}
                onDeleteFolder={handleDeleteFolder}
                onCheckboxClick={toggleItem}
                onMoveSelected={() => setMoveDialogOpen(true)}
                onDeleteSelected={handleBulkDelete}
                onRenameFolder={handleRenameFolderFromPanel}
                onCreateFolderHere={handleCreateFolderInCurrentPath}
                renamingFolderPath={renamingFolderPath}
                onFinishRenameFolder={handleFinishRenameInViewer}
                onCancelRenameFolder={handleCancelRenameInViewer}
                onClearSelection={clearSelection}
                onNavigateUp={currentPath ? handleNavigateUp : undefined}
                onDropItemsOnFolder={handleDropItemsOnTree}
              />
            ) : (
              <VirtualImageList
                items={items}
                selectedKeys={selectedKeys}
                onItemClick={handleItemClick}
                onNavigateFolder={handleNavigateFolder}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMoreImages}
                onDeleteImage={handleDeleteImage}
                onDeleteFolder={handleDeleteFolder}
                onCheckboxClick={toggleItem}
                onMoveSelected={() => setMoveDialogOpen(true)}
                onDeleteSelected={handleBulkDelete}
                onRenameFolder={handleRenameFolderFromPanel}
                onCreateFolderHere={handleCreateFolderInCurrentPath}
                renamingFolderPath={renamingFolderPath}
                onFinishRenameFolder={handleFinishRenameInViewer}
                onCancelRenameFolder={handleCancelRenameInViewer}
                onClearSelection={clearSelection}
                onNavigateUp={currentPath ? handleNavigateUp : undefined}
                onDropItemsOnFolder={handleDropItemsOnTree}
              />
            )}
          </div>
        </div>
      </div>

      {/* Folder picker dialog for move */}
      {dataStore && (
        <FolderPickerDialog
          dataStoreId={dataStore.id}
          open={moveDialogOpen}
          onClose={() => setMoveDialogOpen(false)}
          onSelect={handleBulkMove}
          excludePaths={selectedFolderPaths}
        />
      )}

      {confirmDialog}
    </div>
  )
}
