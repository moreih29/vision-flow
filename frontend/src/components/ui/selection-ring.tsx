import { cn } from "@/lib/utils";

/**
 * 선택 상태를 일관되게 표현하는 wrapper 컴포넌트.
 * "One state, one look" 원칙 — 선택 스타일을 한 곳에서 관리.
 * 사용 예: <SelectionRing selected={isSelected}><Card>...</Card></SelectionRing>
 */
interface SelectionRingProps extends React.ComponentPropsWithoutRef<"div"> {
  /** 선택 상태 활성화 여부 */
  selected?: boolean;
}

function SelectionRing({
  selected = false,
  className,
  children,
  ...props
}: SelectionRingProps) {
  return (
    <div
      data-slot="selection-ring"
      data-selected={selected || undefined}
      className={cn(
        "rounded-[inherit] transition-all",
        selected && "ring-2 ring-primary/50 bg-accent",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { SelectionRing };
