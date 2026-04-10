import { AlertTriangle, ArrowRight, Database, Images } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/layout";
import { useProject } from "@/hooks/use-projects";
import { useVersionStatus, useRestoreSnapshot } from "@/hooks/use-snapshots";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ClassManagePopover } from "./ClassManagePopover";
import type { Task } from "@/types/task";
import type { ChangeCounts } from "@/types/snapshot";
import { TASK_LABELS, TASK_COLORS } from "@/types/task";

function buildDirtySummary(counts?: ChangeCounts): string {
  if (!counts) return "확정되지 않은 변경사항이 있습니다.";
  const parts: string[] = [];
  if (counts.image_added > 0) parts.push(`이미지 ${counts.image_added}개 추가`);
  if (counts.image_removed > 0) parts.push(`${counts.image_removed}개 삭제`);
  if (counts.image_moved > 0) parts.push(`${counts.image_moved}개 이동`);
  if (counts.class_added > 0) parts.push(`클래스 ${counts.class_added}개 추가`);
  if (counts.class_removed > 0) parts.push(`${counts.class_removed}개 삭제`);
  return parts.length > 0
    ? parts.join(", ")
    : "확정되지 않은 변경사항이 있습니다.";
}

interface TaskDetailHeaderProps {
  task: Task | null;
  loading: boolean;
  poolPanelOpen?: boolean;
  onTogglePoolPanel?: () => void;
  onLabelingClick?: () => void;
  onRestoreSuccess?: () => void;
  isRestoring?: boolean;
  /** 우측 버전 rail 열림 상태 */
  versionRailOpen?: boolean;
  /** 우측 버전 rail 토글 */
  onToggleVersionRail?: () => void;
}

export function TaskDetailHeader({
  task,
  loading,
  poolPanelOpen = false,
  onTogglePoolPanel,
  onLabelingClick,
  onRestoreSuccess,
  isRestoring = false,
  versionRailOpen = false,
  onToggleVersionRail,
}: TaskDetailHeaderProps) {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const projectId = Number(id);
  const taskIdNum = Number(taskId);

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: versionStatus, isLoading: versionLoading } =
    useVersionStatus(taskIdNum);
  const restoreMutation = useRestoreSnapshot(taskIdNum);
  const { confirmDialog, confirm } = useConfirmDialog();

  const hasImages = (task?.image_count ?? 0) > 0;
  const isDirty = versionStatus?.is_dirty ?? false;
  const currentVersion = versionStatus?.current_version ?? null;

  function handleLabelingClick() {
    if (!id || !taskId) return;
    onLabelingClick?.();
  }

  async function handleDiscardChanges() {
    if (!versionStatus?.current_snapshot_id) return;
    const confirmed = await confirm({
      title: "변경사항 버리기",
      description: `모든 변경사항을 버리고 현재 버전(${currentVersion})으로 되돌리시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      confirmLabel: "변경사항 버리기",
      variant: "destructive",
    });
    if (!confirmed) return;
    const toastId = toast.loading("변경사항을 버리는 중...");
    try {
      await restoreMutation.mutateAsync({
        id: versionStatus.current_snapshot_id,
        confirm: true,
        skipStash: true,
      });
      toast.success("변경사항을 버렸습니다.", { id: toastId });
      onRestoreSuccess?.();
    } catch {
      toast.error("변경사항 버리기에 실패했습니다.", { id: toastId });
    }
  }

  return (
    <>
      <header className="border-b select-none">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <PageBreadcrumb
            items={[
              {
                label: projectLoading ? "..." : (project?.name ?? "프로젝트"),
                href: `/projects/${id}`,
              },
              { label: loading ? "..." : (task?.name ?? "") },
            ]}
          />
          {!loading && task && (
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${TASK_COLORS[task.task_type]}`}
              >
                {TASK_LABELS[task.task_type]}
              </span>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Images className="h-3.5 w-3.5" />
                  {task.image_count}개
                </span>
                <ClassManagePopover taskId={taskIdNum} disabled={isRestoring} />
                {/* 버전 pill — 클릭 시 우측 rail 토글 */}
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={onToggleVersionRail}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                    versionRailOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : isDirty
                        ? "border-amber-400 text-amber-600 dark:border-amber-500 dark:text-amber-400"
                        : "border-border text-muted-foreground hover:bg-accent"
                  }${isRestoring ? " pointer-events-none opacity-50" : ""}`}
                  title="버전 관리 (V)"
                >
                  {versionLoading ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                  ) : isDirty ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                  {currentVersion
                    ? isDirty
                      ? `${currentVersion}*`
                      : currentVersion
                    : "버전"}
                </button>
              </div>
            </div>
          )}
          {loading && <Skeleton className="h-5 w-48" />}
        </div>
      </header>

      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div>
            {onTogglePoolPanel && (
              <Button
                variant={poolPanelOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={onTogglePoolPanel}
                title="데이터 풀에서 이미지 추가"
                disabled={isRestoring}
              >
                <Database className="mr-1.5 h-3.5 w-3.5" />
                데이터 추가
              </Button>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            disabled={!hasImages}
            title={hasImages ? "라벨링 시작" : "이미지를 먼저 추가하세요"}
            onClick={handleLabelingClick}
          >
            라벨링 시작
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="border-b bg-[var(--dirty-subtle)] dark:bg-[var(--dirty-subtle)]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--dirty-subtle-foreground)]" />
            <span className="flex-1 text-sm text-[var(--dirty-subtle-foreground)]">
              {buildDirtySummary(versionStatus?.counts)}
            </span>
            <button
              type="button"
              disabled={isRestoring}
              className="h-auto p-0 text-sm text-[var(--dirty-subtle-foreground)] underline hover:no-underline disabled:pointer-events-none disabled:opacity-50"
              onClick={onToggleVersionRail}
            >
              버전 확정
            </button>
            {versionStatus?.current_snapshot_id && (
              <button
                type="button"
                disabled={isRestoring}
                className="h-auto p-0 text-sm text-[var(--dirty-subtle-foreground)]/70 underline hover:no-underline disabled:pointer-events-none disabled:opacity-50"
                onClick={handleDiscardChanges}
              >
                변경사항 버리기
              </button>
            )}
          </div>
        </div>
      )}
      {confirmDialog}
    </>
  );
}
