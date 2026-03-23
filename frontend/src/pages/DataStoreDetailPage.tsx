import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Images, LayoutGrid, ListTree } from "lucide-react";
import { imagesApi } from "@/api/images";
import type { FolderInfo } from "@/types/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import ImageUploader from "@/components/ImageUploader";
import ImageGrid from "@/components/ImageGrid";
import FolderCard from "@/components/FolderCard";
import FolderBreadcrumb from "@/components/FolderBreadcrumb";
import FolderTreeView from "@/components/FolderTreeView";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useDataStore } from "@/hooks/use-data-stores";
import { useFolderContents } from "@/hooks/use-folder-contents";
import { useQueryClient } from "@tanstack/react-query";

export default function DataStoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dataStoreId = Number(id);
  const { confirmDialog, confirm, showAlert } = useConfirmDialog();
  const qc = useQueryClient();

  const [currentPath, setCurrentPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");
  const [treeKey, setTreeKey] = useState(0);

  const { data: dataStore, isLoading, isError } = useDataStore(dataStoreId);

  const {
    folders,
    images,
    totalImages,
    isLoading: contentsLoading,
    invalidate: invalidateFolderContents,
  } = useFolderContents(dataStoreId, currentPath);

  async function handleUpload(files: File[], folderPaths?: string[]) {
    setUploading(true);
    try {
      const res = await imagesApi.upload(dataStoreId, files, folderPaths);
      await invalidateFolderContents();
      qc.invalidateQueries({ queryKey: ["data-store", dataStoreId] });
      qc.invalidateQueries({ queryKey: ["data-stores"] });
      const warnings: string[] = [];
      if (res.skipped.length > 0)
        warnings.push(
          `건너뜀 ${res.skipped.length}개: ${res.skipped
            .map((s) => s.reason)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ")}`,
        );
      if (res.failed.length > 0)
        warnings.push(
          `실패 ${res.failed.length}개: ${res.failed
            .slice(0, 3)
            .map((f) => f.name)
            .join(", ")}${res.failed.length > 3 ? " ..." : ""}`,
        );
      if (warnings.length > 0)
        await showAlert({
          title: "업로드 일부 완료",
          description: warnings.join("\n"),
        });
    } catch {
      await showAlert({ title: "이미지 업로드에 실패했습니다." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId: number) {
    const confirmed = await confirm({
      title: "이미지 삭제",
      description: "이미지를 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await imagesApi.delete(imageId);
      await invalidateFolderContents();
      qc.invalidateQueries({ queryKey: ["data-store", dataStoreId] });
      qc.invalidateQueries({ queryKey: ["data-stores"] });
    } catch {
      await showAlert({ title: "이미지 삭제에 실패했습니다." });
    }
  }

  async function handleDeleteFolder(folderPath: string) {
    const confirmed = await confirm({
      title: "폴더 삭제",
      description: `"${folderPath}" 폴더와 하위 이미지를 모두 삭제하시겠습니까?`,
      confirmLabel: "삭제",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await imagesApi.deleteFolder(dataStoreId, folderPath);
      if (
        currentPath === folderPath ||
        currentPath.startsWith(folderPath + "/")
      ) {
        setCurrentPath("");
      } else {
        await invalidateFolderContents();
      }
      qc.invalidateQueries({ queryKey: ["data-store", dataStoreId] });
      qc.invalidateQueries({ queryKey: ["data-stores"] });
      setTreeKey((k) => k + 1);
    } catch {
      await showAlert({ title: "폴더 삭제에 실패했습니다." });
    }
  }

  const handleFolderClick = (folder: FolderInfo) => {
    setCurrentPath(folder.path);
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              dataStore
                ? navigate(`/projects/${dataStore.project_id}`)
                : navigate("/projects")
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex flex-1 items-center gap-3">
              <div>
                <h1 className="text-xl font-bold">{dataStore?.name}</h1>
                {dataStore?.description && (
                  <p className="text-sm text-muted-foreground">
                    {dataStore.description}
                  </p>
                )}
              </div>
              <Badge variant="secondary">
                <Images className="mr-1 h-3 w-3" />
                {dataStore?.image_count ?? 0}개
              </Badge>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {isError && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            데이터를 불러오지 못했습니다.
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
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("grid")}
              title="격자 보기"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "tree" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("tree")}
              title="트리 보기"
            >
              <ListTree className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === "grid" ? (
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
                  총 {totalImages}개
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
                dataStoreId={dataStoreId}
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
                      {currentPath ? currentPath.split("/").pop() : "전체"}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      총 {totalImages}개
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
  );
}
