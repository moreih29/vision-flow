import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { projectsApi } from "@/api/projects";
import { tasksApi } from "@/api/tasks";
import { dataStoresApi } from "@/api/data-stores";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataPoolTab from "@/components/DataPoolTab";
import TasksTab from "@/components/TasksTab";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "pool";
  const currentPath = searchParams.get("folder") ?? "";
  const projectId = Number(id);
  const { confirmDialog, showAlert } = useConfirmDialog();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [poolImageCount, setPoolImageCount] = useState<number | null>(null);
  const [taskCount, setTaskCount] = useState<number | null>(null);

  useEffect(() => {
    fetchProject();
    fetchCounts();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProject() {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.get(projectId);
      setProject(res.data);
    } catch {
      setError("프로젝트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCounts() {
    try {
      const [dataStoresRes, tasksRes] = await Promise.all([
        dataStoresApi.list(projectId),
        tasksApi.list(projectId),
      ]);
      const totalImages = dataStoresRes.data.reduce(
        (sum, d) => sum + d.image_count,
        0,
      );
      setPoolImageCount(totalImages);
      setTaskCount(tasksRes.data.length);
    } catch {
      // counts are cosmetic
    }
  }

  function handleTabChange(newTab: string | number | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newTab === "pool") {
        next.delete("tab");
      } else {
        next.set("tab", newTab as string);
      }
      next.delete("folder");
      return next;
    });
  }

  const handlePathChange = useCallback(
    (path: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (path) {
          next.set("folder", path);
        } else {
          next.delete("folder");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  function openEditDialog() {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? "");
    setEditDialogOpen(true);
  }

  async function handleSaveProject() {
    if (!project || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await projectsApi.update(project.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setProject(res.data);
      setEditDialogOpen(false);
    } catch {
      await showAlert({ title: "프로젝트 수정에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex flex-1 items-center gap-2">
              <div>
                <h1 className="text-xl font-bold">{project?.name}</h1>
                {project?.description && (
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={openEditDialog}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="px-6 py-4 flex-1 flex flex-col overflow-hidden min-h-0">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="pool">
              Data Pool
              {poolImageCount !== null && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {poolImageCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks
              {taskCount !== null && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {taskCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pool" className="flex-1 min-h-0 flex flex-col">
            <DataPoolTab
              projectId={projectId}
              currentPath={currentPath}
              onPathChange={handlePathChange}
            />
          </TabsContent>

          <TabsContent value="tasks" className="flex-1 min-h-0 overflow-auto">
            <TasksTab projectId={projectId} />
          </TabsContent>
        </Tabs>
      </main>

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
              disabled={saving}
            >
              취소
            </Button>
            <Button
              onClick={handleSaveProject}
              disabled={saving || !editName.trim()}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
