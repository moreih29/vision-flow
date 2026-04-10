import { Database, ListTodo } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Pool/Task 모드 구분 배지 — "데이터 풀" vs "Task" 컨텍스트를 시각적으로 표현.
 * Issue #4 결정: StatusBadge(작업 상태용)와 역할 분리를 위해 별도 컴포넌트.
 * semantic token(--mode-pool, --mode-task)만 사용하며 유틸 색상 직접 조립 금지.
 */
const modeBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      mode: {
        pool: "border-mode-pool/30 bg-mode-pool/10 text-mode-pool",
        task: "border-mode-task/30 bg-mode-task/10 text-mode-task",
      },
      variant: {
        badge: "",
        text: "border-transparent bg-transparent px-0 py-0",
      },
    },
    defaultVariants: {
      mode: "task",
      variant: "badge",
    },
  },
);

interface ModeBadgeProps
  extends
    React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof modeBadgeVariants> {
  /** 아이콘 표시 여부 (기본 true) */
  showIcon?: boolean;
  /** 라벨 텍스트 커스터마이징 (기본: "Data Pool" / "Task") */
  label?: string;
}

const DEFAULT_LABELS: Record<NonNullable<ModeBadgeProps["mode"]>, string> = {
  pool: "Data Pool",
  task: "Task",
};

function ModeBadge({
  className,
  mode = "task",
  variant = "badge",
  showIcon = true,
  label,
  children,
  ...props
}: ModeBadgeProps) {
  const Icon = mode === "pool" ? Database : ListTodo;
  const displayLabel = label ?? DEFAULT_LABELS[mode ?? "task"];

  return (
    <span
      data-slot="mode-badge"
      className={cn(modeBadgeVariants({ mode, variant, className }))}
      {...props}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children ?? displayLabel}
    </span>
  );
}

export { ModeBadge };
