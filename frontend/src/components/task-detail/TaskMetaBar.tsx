import { Images } from "lucide-react";
import { ClassManagePopover } from "./ClassManagePopover";
import type { Task } from "@/types/task";
import type { VersionStatus } from "@/types/snapshot";
import { TASK_LABELS, TASK_COLORS } from "@/types/task";

interface TaskMetaBarProps {
  task: Task;
  versionStatus?: VersionStatus | null;
  isRestoring?: boolean;
  /** 우측 버전 rail 열림 상태 */
  versionRailOpen?: boolean;
  /** 우측 버전 rail 토글 */
  onToggleVersionRail?: () => void;
  /** versionStatus 로딩 상태 */
  versionLoading?: boolean;
}

/**
 * DetailLayout의 metaBar slot — 태스크 타입 배지 + 이미지 수 + 클래스 수 + 버전 pill.
 * "Version in sight" 원칙의 상시 표시 지점.
 */
export function TaskMetaBar({
  task,
  versionStatus,
  isRestoring = false,
  versionRailOpen = false,
  onToggleVersionRail,
  versionLoading = false,
}: TaskMetaBarProps) {
  const isDirty = versionStatus?.is_dirty ?? false;
  const currentVersion = versionStatus?.current_version ?? null;

  return (
    <div className="flex flex-wrap items-center gap-3 select-none">
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
        <ClassManagePopover taskId={task.id} disabled={isRestoring} />
        {/* 버전 pill — 클릭 시 우측 rail 토글 */}
        <button
          type="button"
          disabled={isRestoring}
          onClick={onToggleVersionRail}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
            versionRailOpen
              ? "border-primary bg-primary/10 text-primary"
              : isDirty
                ? "border-dirty text-dirty"
                : "border-border text-muted-foreground hover:bg-accent"
          }${isRestoring ? " pointer-events-none opacity-50" : ""}`}
          title="버전 관리 (V)"
        >
          {versionLoading ? (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
          ) : isDirty ? (
            <span className="h-1.5 w-1.5 rounded-full bg-dirty" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
          )}
          {currentVersion
            ? isDirty
              ? `${currentVersion}*`
              : currentVersion
            : "버전"}
        </button>
      </div>
    </div>
  );
}
