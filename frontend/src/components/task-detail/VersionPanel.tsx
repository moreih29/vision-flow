import { useState } from "react";
import { Archive, MoreVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSnapshots,
  useCreateSnapshot,
  useRestoreSnapshot,
  useDeleteSnapshot,
  useVersionStatus,
  useStash,
  useDeleteStash,
} from "@/hooks/use-snapshots";
import type { Snapshot } from "@/types/snapshot";

interface VersionPanelProps {
  taskId: number;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function versionLabel(snapshot: Snapshot): string {
  return `v${snapshot.major_version}.${snapshot.data_version}.${snapshot.label_version}`;
}

export function VersionPanel({ taskId }: VersionPanelProps) {
  const { data: snapshots, isLoading } = useSnapshots(taskId);
  const { data: versionStatus } = useVersionStatus(taskId);
  const createMutation = useCreateSnapshot(taskId);
  const restoreMutation = useRestoreSnapshot(taskId);
  const deleteMutation = useDeleteSnapshot(taskId);
  const deleteStashMutation = useDeleteStash(taskId);

  const [addingSnapshot, setAddingSnapshot] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null);
  const [deleteStashOpen, setDeleteStashOpen] = useState(false);

  const { data: stash } = useStash(taskId);
  const isDirty = versionStatus?.is_dirty ?? false;
  const changes = versionStatus?.changes ?? {};

  function buildChangeSummary(): string {
    const parts: string[] = [];
    if (changes.class_changed) parts.push("클래스 변경");
    if (changes.data_changed) parts.push("데이터 변경");
    if (changes.label_changed) parts.push("라벨 변경");
    return parts.join(", ");
  }

  async function handleCreate() {
    if (!newSnapshotName.trim()) return;
    try {
      await createMutation.mutateAsync({ name: newSnapshotName.trim() });
      setNewSnapshotName("");
      setAddingSnapshot(false);
      toast.success("버전이 확정되었습니다.");
    } catch {
      toast.error("버전 확정에 실패했습니다.");
    }
  }

  async function handleRestoreDirect() {
    if (!restoreTarget) return;
    try {
      await restoreMutation.mutateAsync({
        id: restoreTarget.id,
        confirm: true,
      });
      toast.success(`${versionLabel(restoreTarget)}으로 복원되었습니다.`);
    } catch {
      toast.error("복원에 실패했습니다.");
    } finally {
      setRestoreTarget(null);
    }
  }

  async function handleRestoreWithAutoCommit() {
    if (!restoreTarget) return;
    try {
      const autoName = versionStatus?.current_version
        ? `${versionStatus.current_version} (복원 전 자동 확정)`
        : "복원 전 자동 확정";
      await createMutation.mutateAsync({ name: autoName });
      await restoreMutation.mutateAsync({
        id: restoreTarget.id,
        confirm: true,
      });
      toast.success(
        `현재 상태를 확정하고 ${versionLabel(restoreTarget)}으로 복원했습니다.`,
      );
    } catch {
      toast.error("복원에 실패했습니다.");
    } finally {
      setRestoreTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("버전이 삭제되었습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleRestoreStash() {
    if (!stash) return;
    try {
      await restoreMutation.mutateAsync({ id: stash.id, confirm: true });
      toast.success("임시 저장된 작업을 복원했습니다.");
    } catch {
      toast.error("복원에 실패했습니다.");
    }
  }

  async function handleDeleteStash() {
    try {
      await deleteStashMutation.mutateAsync();
      toast.success("임시 저장이 삭제되었습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    } finally {
      setDeleteStashOpen(false);
    }
  }

  // major / data 버전 경계 추적
  let prevMajor: number | null = null;
  let prevData: number | null = null;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* dirty 상태 표시 */}
      {versionStatus && (
        <div className="flex flex-col gap-1">
          {isDirty ? (
            <div className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  변경사항 있음
                </Badge>
                {versionStatus.current_version && (
                  <span className="text-xs text-muted-foreground">
                    현재 {versionStatus.current_version}
                  </span>
                )}
              </div>
              {buildChangeSummary() && (
                <p className="text-xs text-muted-foreground">
                  {buildChangeSummary()}
                </p>
              )}
            </div>
          ) : (
            versionStatus.current_version && (
              <p className="text-xs text-muted-foreground px-1">
                현재 버전: {versionStatus.current_version}
              </p>
            )
          )}
        </div>
      )}

      {/* stash 배너 */}
      {stash && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
          <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              임시 저장된 작업이 있습니다
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              {stash.image_count}개 이미지 · {stash.annotation_count}개 라벨
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
              onClick={handleRestoreStash}
              disabled={restoreMutation.isPending}
            >
              복원
            </button>
            <span className="text-amber-400">·</span>
            <button
              type="button"
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
              onClick={() => setDeleteStashOpen(true)}
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 생성 영역 */}
      <div>
        {addingSnapshot ? (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <Input
              value={newSnapshotName}
              onChange={(e) => setNewSnapshotName(e.target.value)}
              placeholder="버전 이름"
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setAddingSnapshot(false);
                  setNewSnapshotName("");
                }
              }}
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleCreate}
                disabled={createMutation.isPending || !newSnapshotName.trim()}
              >
                {createMutation.isPending ? "확정 중..." : "확정"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setAddingSnapshot(false);
                  setNewSnapshotName("");
                }}
                disabled={createMutation.isPending}
              >
                취소
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => setAddingSnapshot(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            버전 확정
          </Button>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !snapshots || snapshots.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            버전이 없습니다.
            <br />
            버튼을 눌러 현재 상태를 저장하세요.
          </p>
        ) : (
          snapshots.map((snapshot) => {
            const showMajorDivider =
              prevMajor !== null && snapshot.major_version !== prevMajor;
            const showDataDivider =
              !showMajorDivider &&
              prevData !== null &&
              snapshot.data_version !== prevData;
            prevMajor = snapshot.major_version;
            prevData = snapshot.data_version;

            return (
              <div key={snapshot.id}>
                {showMajorDivider && <div className="border-t my-2" />}
                {showDataDivider && (
                  <div className="border-t border-dashed opacity-40 my-1.5" />
                )}
                <div className="group relative rounded-md border px-3 py-2 hover:bg-accent transition-colors">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        <span className="text-muted-foreground text-xs mr-1">
                          {versionLabel(snapshot)}
                        </span>
                        {snapshot.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {snapshot.image_count}개 이미지 ·{" "}
                        {snapshot.labeled_image_count}개 라벨링
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {formatRelativeTime(snapshot.created_at)}
                      </p>
                    </div>

                    {/* 메뉴 버튼 */}
                    <div className="relative shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === snapshot.id ? null : snapshot.id,
                          );
                        }}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>

                      {openMenuId === snapshot.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-7 z-20 min-w-[120px] rounded-md border bg-popover shadow-md py-1">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                              onClick={() => {
                                setRestoreTarget(snapshot);
                                setOpenMenuId(null);
                              }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              복원
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent transition-colors"
                              onClick={() => {
                                setDeleteTarget(snapshot);
                                setOpenMenuId(null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 복원 확인 다이얼로그 */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>버전 복원</AlertDialogTitle>
            {isDirty ? (
              <AlertDialogDescription>
                확정되지 않은 변경사항이 있습니다.{" "}
                <strong>
                  {restoreTarget ? versionLabel(restoreTarget) : ""} —{" "}
                  {restoreTarget?.name}
                </strong>
                으로 복원하시겠습니까?
                <br />
                <span className="text-amber-600 dark:text-amber-400">
                  현재 변경사항은 자동으로 임시 저장됩니다.
                </span>
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                <strong>
                  {restoreTarget ? versionLabel(restoreTarget) : ""} —{" "}
                  {restoreTarget?.name}
                </strong>
                으로 복원합니다. 계속하시겠습니까?
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRestoreTarget(null)}>
              취소
            </AlertDialogCancel>
            {isDirty ? (
              <>
                <AlertDialogAction
                  variant="outline"
                  onClick={handleRestoreWithAutoCommit}
                  disabled={
                    createMutation.isPending || restoreMutation.isPending
                  }
                >
                  {createMutation.isPending || restoreMutation.isPending
                    ? "처리 중..."
                    : "먼저 확정 후 복원"}
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={handleRestoreDirect}
                  disabled={
                    restoreMutation.isPending || createMutation.isPending
                  }
                >
                  {restoreMutation.isPending
                    ? "복원 중..."
                    : "변경사항 버리고 복원"}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={handleRestoreDirect}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? "복원 중..." : "복원"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* stash 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteStashOpen} onOpenChange={setDeleteStashOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>임시 저장 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              임시 저장된 작업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteStash}
              disabled={deleteStashMutation.isPending}
            >
              {deleteStashMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>버전 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>
                {deleteTarget ? versionLabel(deleteTarget) : ""} —{" "}
                {deleteTarget?.name}
              </strong>
              을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
