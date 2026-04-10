import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 도메인 특화 상태 배지 컴포넌트.
 * semantic 토큰 기반으로 색상을 조립하며, dot indicator를 포함.
 * 범용 배지는 badge.tsx를 사용하고, 어노테이션/파일 상태 표현에 이 컴포넌트를 사용.
 */
const statusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      state: {
        dirty: "bg-dirty/10 text-dirty dark:bg-dirty/20",
        reviewed: "bg-reviewed/10 text-reviewed dark:bg-reviewed/20",
        labeling: "bg-primary/10 text-primary dark:bg-primary/20",
        draft: "bg-muted text-muted-foreground",
        completed: "bg-reviewed/10 text-reviewed dark:bg-reviewed/20",
      },
    },
    defaultVariants: {
      state: "draft",
    },
  },
);

const statusDotVariants = cva("size-1.5 rounded-full shrink-0", {
  variants: {
    state: {
      dirty: "bg-dirty",
      reviewed: "bg-reviewed",
      labeling: "bg-primary",
      draft: "bg-muted-foreground",
      completed: "bg-reviewed",
    },
  },
  defaultVariants: {
    state: "draft",
  },
});

interface StatusBadgeProps
  extends
    React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof statusBadgeVariants> {}

function StatusBadge({
  className,
  state,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ state, className }))}
      {...props}
    >
      <span className={statusDotVariants({ state })} aria-hidden="true" />
      {children}
    </span>
  );
}

export { StatusBadge };
