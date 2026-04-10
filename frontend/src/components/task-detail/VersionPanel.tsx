import { useMemo, useState } from "react";
import { Archive, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  onRestoreSuccess?: () => void;
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
  return `v${snapshot.major_version}.${snapshot.minor_version}`;
}

export function VersionPanel({ taskId, onRestoreSuccess }: VersionPanelProps) {
  const { data: snapshots, isLoading } = useSnapshots(taskId);
  const { data: versionStatus, isLoading: isVersionStatusLoading } =
    useVersionStatus(taskId);
  const createMutation = useCreateSnapshot(taskId);
  const restoreMutation = useRestoreSnapshot(taskId);
  const deleteMutation = useDeleteSnapshot(taskId);
  const deleteStashMutation = useDeleteStash(taskId);

  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null);
  const [deleteStashOpen, setDeleteStashOpen] = useState(false);

  const { data: stash } = useStash(taskId);
  const isDirty = isVersionStatusLoading
    ? false
    : (versionStatus?.is_dirty ?? false);
  const changes = versionStatus?.changes ?? {};

  function buildChangeSummary(): string {
    const counts = versionStatus?.counts;
    if (counts) {
      const parts: string[] = [];
      if (counts.image_added > 0)
        parts.push(`이미지 ${counts.image_added}개 추가`);
      if (counts.image_removed > 0)
        parts.push(`${counts.image_removed}개 삭제`);
      if (counts.image_moved > 0) parts.push(`${counts.image_moved}개 이동`);
      if (counts.class_added > 0)
        parts.push(`클래스 ${counts.class_added}개 추가`);
      if (counts.class_removed > 0)
        parts.push(`${counts.class_removed}개 삭제`);
      if (parts.length > 0) return parts.join(", ");
    }
    // fallback
    const fallbackParts: string[] = [];
    if (changes.class_changed) fallbackParts.push("클래스 변경");
    if (changes.data_changed) fallbackParts.push("데이터 변경");
    return fallbackParts.join(", ");
  }

  async function handleCreate() {
    const name =
      newSnapshotName.trim() || buildChangeSummary() || "변경사항 확정";
    try {
      await createMutation.mutateAsync({ name });
      setNewSnapshotName("");
      toast.success("버전이 확정되었습니다.");
    } catch {
      toast.error("버전 확정에 실패했습니다.");
    }
  }

  async function handleRestoreWithStash() {
    if (!restoreTarget) return;
    try {
      await restoreMutation.mutateAsync({
        id: restoreTarget.id,
        confirm: true,
      });
      toast.success(
        `임시 저장 후 ${versionLabel(restoreTarget)}으로 복원되었습니다.`,
      );
      onRestoreSuccess?.();
    } catch {
      toast.error("복원에 실패했습니다.");
    } finally {
      setRestoreTarget(null);
    }
  }

  async function handleRestoreDiscard() {
    if (!restoreTarget) return;
    try {
      await restoreMutation.mutateAsync({
        id: restoreTarget.id,
        confirm: true,
        skipStash: true,
      });
      toast.success(`${versionLabel(restoreTarget)}으로 복원되었습니다.`);
      onRestoreSuccess?.();
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
    const toastId = toast.loading("임시 저장을 복원하는 중...");
    try {
      await restoreMutation.mutateAsync({ id: stash.id, confirm: true });
      toast.success("임시 저장된 작업을 복원했습니다.", { id: toastId });
      onRestoreSuccess?.();
    } catch {
      toast.error("복원에 실패했습니다.", { id: toastId });
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

  const snapshotsWithGap = useMemo(() => {
    if (!snapshots) return [];
    let prevMajor: number | null = null;
    return snapshots.map((snapshot) => {
      const showMajorGap =
        prevMajor !== null && snapshot.major_version !== prevMajor;
      prevMajor = snapshot.major_version;
      return { snapshot, showMajorGap };
    });
  }, [snapshots]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* stash 배너 */}
      {stash && (
        <div className="flex items-start gap-2 rounded-md border border-dirty-subtle-foreground/20 bg-dirty-subtle px-3 py-2">
          <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dirty-subtle-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-dirty-subtle-foreground">
              임시 저장된 작업이 있습니다
            </p>
            <p className="text-xs text-dirty-subtle-foreground/70">
              {stash.image_count}개 이미지 · {stash.annotation_count}개 라벨
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="text-xs text-dirty-subtle-foreground hover:underline"
              onClick={handleRestoreStash}
              disabled={restoreMutation.isPending}
            >
              복원
            </button>
            <span className="text-dirty-subtle-foreground/50">·</span>
            <button
              type="button"
              className="text-xs text-dirty-subtle-foreground hover:underline"
              onClick={() => setDeleteStashOpen(true)}
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 타임라인 */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* 수직선 */}
            <div className="absolute left-[6px] top-0 bottom-0 w-px bg-border" />

            {/* dirty 상태 로딩 중: 펄스 dot */}
            {isVersionStatusLoading && (
              <div className="relative pl-5 pb-3">
                <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-amber-500 bg-amber-500 animate-pulse" />
                <p className="text-xs text-muted-foreground">확인 중...</p>
              </div>
            )}

            {/* dirty일 때: 미확정 커밋 엔트리 */}
            {isDirty && (
              <div className="relative pl-5 pb-3">
                <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-amber-500 bg-amber-500" />
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    placeholder="설명 (선택사항)"
                    className="h-6 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setNewSnapshotName("");
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-6 text-xs px-2 shrink-0"
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "확정 중..." : "확정"}
                  </Button>
                </div>
                {(() => {
                  const summary = buildChangeSummary();
                  return summary ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {summary}
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            {/* 스냅샷 목록 */}
            {!snapshots || snapshots.length === 0 ? (
              <div className="relative pl-5 py-4">
                <p className="text-center text-xs text-muted-foreground">
                  버전이 없습니다.
                  <br />
                  변경사항을 확정하면 버전이 저장됩니다.
                </p>
              </div>
            ) : (
              snapshotsWithGap.map(({ snapshot, showMajorGap }) => {
                const isHead =
                  versionLabel(snapshot) === versionStatus?.current_version;

                return (
                  <div key={snapshot.id}>
                    {showMajorGap && <div className="h-3" />}
                    <div className="group relative pl-5 pb-2">
                      {/* dot */}
                      <div
                        className={`absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 ${
                          isHead
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30 bg-background"
                        }`}
                      />

                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold">
                              {versionLabel(snapshot)}
                            </span>
                            {isHead && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded leading-4">
                                현재
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              {snapshot.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {snapshot.restored_from_id &&
                              (() => {
                                const from = snapshots?.find(
                                  (s) => s.id === snapshot.restored_from_id,
                                );
                                return from ? (
                                  <>
                                    <span>↩ {versionLabel(from)} 기반</span>
                                    {" · "}
                                  </>
                                ) : null;
                              })()}
                            {snapshot.image_count}개 이미지 ·{" "}
                            {snapshot.labeled_image_count}개 라벨링
                          </p>
                        </div>

                        <div className="flex items-start gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground/70 mt-0.5 whitespace-nowrap">
                            {formatRelativeTime(snapshot.created_at)}
                          </span>

                          {/* 메뉴 버튼 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === snapshot.id) {
                                setOpenMenuId(null);
                                setMenuPos(null);
                              } else {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                const spaceBelow =
                                  window.innerHeight - rect.bottom;
                                const menuHeight = 80;
                                setMenuPos({
                                  x: rect.right - 120,
                                  y:
                                    spaceBelow > menuHeight
                                      ? rect.bottom + 4
                                      : rect.top - menuHeight - 4,
                                });
                                setOpenMenuId(snapshot.id);
                              }
                            }}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* fixed 메뉴 */}
      {openMenuId !== null && menuPos && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => {
              setOpenMenuId(null);
              setMenuPos(null);
            }}
          />
          <div
            className="fixed z-50 min-w-[120px] rounded-md border bg-popover shadow-md py-1"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => {
                const target = snapshots?.find((s) => s.id === openMenuId);
                if (target) setRestoreTarget(target);
                setOpenMenuId(null);
                setMenuPos(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              복원
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent transition-colors"
              onClick={() => {
                const target = snapshots?.find((s) => s.id === openMenuId);
                if (target) setDeleteTarget(target);
                setOpenMenuId(null);
                setMenuPos(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>
        </>
      )}

      {/* 복원 확인 다이얼로그 */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open) => {
          if (!open && !restoreMutation.isPending) setRestoreTarget(null);
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
            <AlertDialogCancel
              onClick={() => setRestoreTarget(null)}
              disabled={restoreMutation.isPending}
            >
              취소
            </AlertDialogCancel>
            {isDirty ? (
              <>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleRestoreDiscard}
                  disabled={restoreMutation.isPending}
                >
                  {restoreMutation.isPending ? "복원 중..." : "버리고 복원"}
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={handleRestoreWithStash}
                  disabled={restoreMutation.isPending}
                >
                  {restoreMutation.isPending
                    ? "처리 중..."
                    : "임시 저장 후 복원"}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={handleRestoreWithStash}
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
              을(를) 삭제하시겠습니까? 데이터는 되돌아가지 않습니다. 이전 버전
              이름표만 이동합니다.
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
