import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue>({
  open: false,
  onOpenChange: () => {},
  triggerRef: { current: null },
});

function usePopoverContext() {
  return React.useContext(PopoverContext);
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  return (
    <PopoverContext.Provider
      value={{ open, onOpenChange: setOpen, triggerRef }}
    >
      {children}
    </PopoverContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------
interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, children, onClick, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = usePopoverContext();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      onOpenChange(!open);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        // eslint-disable-next-line react-hooks/refs -- cloneElement ref forwarding pattern
        {
          ref: (node: HTMLElement | null) => {
            triggerRef.current = node;
            if (typeof ref === "function") ref(node as HTMLButtonElement);
            else if (ref) ref.current = node as HTMLButtonElement;
          },
          onClick: (e: React.MouseEvent) => {
            (
              children.props as { onClick?: (e: React.MouseEvent) => void }
            ).onClick?.(e);
            handleClick(e as React.MouseEvent<HTMLButtonElement>);
          },
        },
      );
    }

    return (
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        {...props}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  },
);
PopoverTrigger.displayName = "PopoverTrigger";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
}

function PopoverContent({
  className,
  children,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  style,
  ...props
}: PopoverContentProps) {
  const { open, onOpenChange, triggerRef } = usePopoverContext();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<React.CSSProperties>({});

  React.useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();

    let top = 0;
    let left = 0;

    if (side === "bottom") {
      top = rect.bottom + sideOffset + window.scrollY;
    } else if (side === "top") {
      top = rect.top - sideOffset + window.scrollY;
    }

    if (align === "start") {
      left = rect.left + window.scrollX;
    } else if (align === "center") {
      left = rect.left + rect.width / 2 + window.scrollX;
    }

    // align="end": 드롭다운 우측 끝을 트리거 우측 끝에 맞춤
    const rightEdge =
      align === "end" ? window.innerWidth - rect.right : undefined;

    setPosition(
      side === "top"
        ? {
            bottom: `calc(100vh - ${top}px)`,
            ...(align === "end" ? { right: rightEdge } : { left }),
            position: "absolute",
          }
        : {
            top,
            ...(align === "end" ? { right: rightEdge } : { left }),
            position: "absolute",
          },
    );
  }, [open, side, align, sideOffset, triggerRef]);

  if (!open) return null;

  return createPortal(
    <>
      {/* dismiss overlay */}
      <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
      <div
        ref={contentRef}
        data-slot="popover-content"
        className={cn(
          "z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none",
          className,
        )}
        style={{ ...position, ...style }}
        {...props}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export { Popover, PopoverTrigger, PopoverContent };
