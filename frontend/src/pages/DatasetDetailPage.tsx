import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Images, LayoutGrid, ListTree } from 'lucide-react'
import { datasetsApi } from '@/api/datasets'
import { imagesApi } from '@/api/images'
import type { Dataset } from '@/types/dataset'
import type { FolderContentsResponse, FolderInfo, ImageMeta } from '@/types/image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import ImageUploader from '@/components/ImageUploader'
import ImageGrid from '@/components/ImageGrid'
import FolderCard from '@/components/FolderCard'
import FolderBreadcrumb from '@/components/FolderBreadcrumb'
import FolderTreeView from '@/components/FolderTreeView'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const datasetId = Number(id)
  const { confirmDialog, confirm, showAlert } = useConfirmDialog()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [folderContents, setFolderContents] =
    useState<FolderContentsResponse | null>(null)
  const [currentPath, setCurrentPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [contentsLoading, setContentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid')
  const [treeKey, setTreeKey] = useState(0)

  useEffect(() => {
    fetchDataset()
  }, [datasetId])

  useEffect(() => {
    fetchFolderContents(currentPath)
  }, [datasetId, currentPath])

  async function fetchDataset() {
    setLoading(true)
    setError(null)
    try {
      const res = await datasetsApi.get(datasetId)
      setDataset(res.data)
    } catch {
      setError('\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchFolderContents(path: string) {
    setContentsLoading(true)
    try {
      const res = await imagesApi.getFolderContents(datasetId, path)
      setFolderContents(res.data)
    } catch {
      setError('\uD3F4\uB354 \uB0B4\uC6A9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.')
    } finally {
      setContentsLoading(false)
    }
  }

  const handleUpload = useCallback(
    async (files: File[], folderPaths?: string[]) => {
      setUploading(true)
      try {
        const res = await imagesApi.upload(datasetId, files, folderPaths)
        setDataset((prev) =>
          prev
            ? { ...prev, image_count: prev.image_count + res.data.length }
            : prev,
        )
        await fetchFolderContents(currentPath)
        const warnings: string[] = []
        if (res.skipped.length > 0)
          warnings.push(`건너뜀 ${res.skipped.length}개: ${res.skipped.map((s) => s.reason).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`)
        if (res.failed.length > 0)
          warnings.push(`실패 ${res.failed.length}개: ${res.failed.slice(0, 3).map((f) => f.name).join(', ')}${res.failed.length > 3 ? ' ...' : ''}`)
        if (warnings.length > 0)
          await showAlert({ title: '업로드 일부 완료', description: warnings.join('\n') })
      } catch {
        await showAlert({ title: '이미지 업로드에 실패했습니다.' })
      } finally {
        setUploading(false)
      }
    },
    [datasetId, currentPath],
  )

  async function handleDeleteImage(imageId: number) {
    const confirmed = await confirm({
      title: '\uC774\uBBF8\uC9C0 \uC0AD\uC81C',
      description: '\uC774\uBBF8\uC9C0\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?',
      confirmLabel: '\uC0AD\uC81C',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await imagesApi.delete(imageId)
      setFolderContents((prev) =>
        prev
          ? {
              ...prev,
              images: prev.images.filter((img) => img.id !== imageId),
              total_images: prev.total_images - 1,
            }
          : prev,
      )
      setDataset((prev) =>
        prev
          ? { ...prev, image_count: Math.max(0, prev.image_count - 1) }
          : prev,
      )
    } catch {
      await showAlert({ title: '\uC774\uBBF8\uC9C0 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.' })
    }
  }

  async function handleDeleteFolder(folderPath: string) {
    const confirmed = await confirm({
      title: '\uD3F4\uB354 \uC0AD\uC81C',
      description: `"${folderPath}" \uD3F4\uB354\uC640 \uD558\uC704 \uC774\uBBF8\uC9C0\uB97C \uBAA8\uB450 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`,
      confirmLabel: '\uC0AD\uC81C',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await imagesApi.deleteFolder(datasetId, folderPath)
      if (
        currentPath === folderPath ||
        currentPath.startsWith(folderPath + '/')
      ) {
        setCurrentPath('')
      } else {
        await fetchFolderContents(currentPath)
      }
      await fetchDataset()
      setTreeKey((k) => k + 1)
    } catch {
      await showAlert({ title: '\uD3F4\uB354 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.' })
    }
  }

  const handleFolderClick = (folder: FolderInfo) => {
    setCurrentPath(folder.path)
  }

  const handleNavigate = (path: string) => {
    setCurrentPath(path)
  }

  const images: ImageMeta[] = folderContents?.images ?? []
  const folders: FolderInfo[] = folderContents?.folders ?? []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              dataset
                ? navigate(`/projects/${dataset.project_id}`)
                : navigate('/projects')
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex flex-1 items-center gap-3">
              <div>
                <h1 className="text-xl font-bold">{dataset?.name}</h1>
                {dataset?.description && (
                  <p className="text-sm text-muted-foreground">
                    {dataset.description}
                  </p>
                )}
              </div>
              <Badge variant="secondary">
                <Images className="mr-1 h-3 w-3" />
                {dataset?.image_count ?? 0}개
              </Badge>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-6">
          <ImageUploader onUpload={handleUpload} uploading={uploading} />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <FolderBreadcrumb
            currentPath={currentPath}
            onNavigate={handleNavigate}
          />
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('grid')}
              title="격자 보기"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('tree')}
              title="트리 보기"
            >
              <ListTree className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          contentsLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <Skeleton className="aspect-square w-full rounded-md" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {folders.length > 0 && (
                <div className="mb-6">
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    폴더
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {folders.map((folder) => (
                      <FolderCard
                        key={folder.path}
                        folder={folder}
                        onClick={() => handleFolderClick(folder)}
                        onDelete={() => handleDeleteFolder(folder.path)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">이미지</h2>
                <span className="text-sm text-muted-foreground">
                  총 {images.length}개
                </span>
              </div>
              <ImageGrid images={images} onDelete={handleDeleteImage} />
            </>
          )
        ) : (
          <div className="flex gap-4">
            <div className="w-64 shrink-0 rounded-lg border p-2">
              <FolderTreeView
                key={treeKey}
                datasetId={datasetId}
                selectedPath={currentPath}
                onSelectPath={setCurrentPath}
                onDeleteFolder={handleDeleteFolder}
              />
            </div>
            <div className="min-w-0 flex-1">
              {contentsLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <Skeleton className="aspect-square w-full rounded-md" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {currentPath
                        ? currentPath.split('/').pop()
                        : '\uC804\uCCB4'}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      총 {images.length}개
                    </span>
                  </div>
                  <ImageGrid images={images} onDelete={handleDeleteImage} />
                </>
              )}
            </div>
          </div>
        )}
      </main>
      {confirmDialog}
    </div>
  )
}
