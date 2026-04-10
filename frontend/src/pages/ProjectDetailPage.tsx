import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Database, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBreadcrumb, DetailLayout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TasksTab from "@/components/TasksTab";
import { useProject, useUpdateProject } from "@/hooks/use-projects";
import { useDataStores } from "@/hooks/use-data-stores";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  const { confirmDialog, showAlert } = useConfirmDialog();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: project, isLoading, isError } = useProject(projectId);
  const { data: dataStores } = useDataStores(projectId);
  const updateProject = useUpdateProject(projectId);

  const poolImageCount = dataStores
    ? dataStores.reduce((sum, d) => sum + d.image_count, 0)
    : null;
  const dataStoreCount = dataStores?.length ?? null;

  function openEditDialog() {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setEditDialogOpen(true);
  }

  async function handleSaveProject() {
    if (!project || !editName.trim()) return;
    try {
      await updateProject.mutateAsync({
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditDialogOpen(false);
    } catch {
      await showAlert({ title: "프로젝트 수정에 실패했습니다." });
    }
  }

  const headerSlot = (
    <div className="flex items-center gap-4">
      <PageBreadcrumb
        items={[
          { label: "프로젝트 목록", href: "/projects" },
          { label: isLoading ? "..." : (project?.name ?? "") },
        ]}
      />
      {!isLoading && (
        <div className="flex items-center gap-2">
          {project?.description && (
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {project.description}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={openEditDialog}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )}
      {isLoading && <Skeleton className="h-5 w-48" />}
    </div>
  );

  return (
    <DetailLayout header={headerSlot}>
      {isError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          프로젝트를 불러오지 못했습니다.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* 데이터풀 요약 카드 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              데이터풀
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/projects/${projectId}/data-pool`)}
            >
              관리
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-bold">
                  {poolImageCount !== null
                    ? poolImageCount.toLocaleString()
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">전체 이미지</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dataStoreCount !== null ? dataStoreCount : "—"}
                </p>
                <p className="text-xs text-muted-foreground">데이터 스토어</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 태스크 목록 */}
        <TasksTab projectId={projectId} />
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 수정</DialogTitle>
            <DialogDescription>
              프로젝트 이름과 설명을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">이름 *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-desc">설명</Label>
              <Textarea
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={updateProject.isPending}
            >
              취소
            </Button>
            <Button
              onClick={handleSaveProject}
              disabled={updateProject.isPending || !editName.trim()}
            >
              {updateProject.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </DetailLayout>
  );
}
