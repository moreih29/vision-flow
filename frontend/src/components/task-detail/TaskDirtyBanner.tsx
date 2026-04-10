import { AlertTriangle } from "lucide-react";
import type { VersionStatus, ChangeCounts } from "@/types/snapshot";

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

interface TaskDirtyBannerProps {
  versionStatus?: VersionStatus | null;
  isDirty: boolean;
  isRestoring?: boolean;
  onDiscardChanges: () => void;
  onCommitVersion: () => void;
}

/**
 * DetailLayout의 statusBanner slot — isDirty=false면 null을 반환하여
 * DetailLayout이 배너 영역 자체를 렌더하지 않도록 한다.
 */
export function TaskDirtyBanner({
  versionStatus,
  isDirty,
  isRestoring = false,
  onDiscardChanges,
  onCommitVersion,
}: TaskDirtyBannerProps) {
  if (!isDirty) return null;

  return (
    <div className="border-b bg-[var(--dirty-subtle)] dark:bg-[var(--dirty-subtle)]">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--dirty-subtle-foreground)]" />
        <span className="flex-1 text-sm text-[var(--dirty-subtle-foreground)]">
          {buildDirtySummary(versionStatus?.counts)}
        </span>
        <button
          type="button"
          disabled={isRestoring}
          className="h-auto p-0 text-sm text-[var(--dirty-subtle-foreground)] underline hover:no-underline disabled:pointer-events-none disabled:opacity-50"
          onClick={onCommitVersion}
        >
          버전 확정
        </button>
        {versionStatus?.current_snapshot_id && (
          <button
            type="button"
            disabled={isRestoring}
            className="h-auto p-0 text-sm text-[var(--dirty-subtle-foreground)]/70 underline hover:no-underline disabled:pointer-events-none disabled:opacity-50"
            onClick={onDiscardChanges}
          >
            변경사항 버리기
          </button>
        )}
      </div>
    </div>
  );
}
