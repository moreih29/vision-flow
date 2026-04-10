import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 키보드 단축키 힌트 표시 컴포넌트 (Keyboard first 원칙)
 * 단축키 매핑된 interactive element 옆에 배치.
 * 키 눌림 시 animate-pulse-key 클래스를 동적으로 추가하면 Fast feedback 효과 적용 가능.
 */
const kbdVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-sm border border-border bg-muted font-mono font-medium leading-none text-muted-foreground select-none",
  {
    variants: {
      size: {
        default: "h-5 min-w-5 px-1 text-xs",
        sm: "h-4 min-w-4 px-0.5 text-[0.625rem]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

interface KbdProps
  extends
    React.ComponentPropsWithoutRef<"kbd">,
    VariantProps<typeof kbdVariants> {}

function Kbd({ className, size, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ size, className }))}
      {...props}
    />
  );
}

export { Kbd };
