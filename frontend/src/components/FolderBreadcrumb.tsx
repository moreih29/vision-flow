import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

interface FolderBreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function FolderBreadcrumb({
  currentPath,
  onNavigate,
}: FolderBreadcrumbProps) {
  const segments = currentPath ? currentPath.split("/").filter(Boolean) : [];

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dropdownOpen]);

  // 4개 이상이면 접기: 처음 1개 + 중간 생략 + 마지막 2개
  const shouldCollapse = segments.length >= 4;
  const visibleStart = shouldCollapse ? segments.slice(0, 1) : segments;
  const hiddenMiddle = shouldCollapse
    ? segments.slice(1, segments.length - 2)
    : [];
  const visibleEnd = shouldCollapse ? segments.slice(segments.length - 2) : [];

  function handleNavigate(index: number) {
    const path = segments.slice(0, index + 1).join("/");
    onNavigate(path);
    setDropdownOpen(false);
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      {/* 루트 */}
      <button
        type="button"
        onClick={() => onNavigate("")}
        className={`transition-colors hover:text-foreground ${
          segments.length === 0
            ? "font-medium text-foreground"
            : "text-muted-foreground"
        }`}
      >
        전체
      </button>

      {/* 접기 미적용: 전체 표시 */}
      {!shouldCollapse &&
        segments.map((segment, index) => {
          const path = segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                type="button"
                onClick={() => onNavigate(path)}
                className={`transition-colors hover:text-foreground ${
                  isLast
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {segment}
              </button>
            </span>
          );
        })}

      {/* 접기 적용 */}
      {shouldCollapse && (
        <>
          {/* 앞쪽 표시 세그먼트 */}
          {visibleStart.map((segment, index) => {
            const isLast = false;
            const path = segments.slice(0, index + 1).join("/");
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => onNavigate(path)}
                  className={`transition-colors hover:text-foreground ${
                    isLast
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {segment}
                </button>
              </span>
            );
          })}

          {/* 생략 버튼 + 드롭다운 */}
          <span className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="숨겨진 경로 보기"
              >
                ...
              </button>
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
                  {hiddenMiddle.map((segment, i) => {
                    const absoluteIndex = 1 + i;
                    return (
                      <button
                        key={absoluteIndex}
                        type="button"
                        onClick={() => handleNavigate(absoluteIndex)}
                        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
                      >
                        {segment}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </span>

          {/* 뒤쪽 표시 세그먼트 */}
          {visibleEnd.map((segment, i) => {
            const absoluteIndex = segments.length - 2 + i;
            const isLast = absoluteIndex === segments.length - 1;
            const path = segments.slice(0, absoluteIndex + 1).join("/");
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => onNavigate(path)}
                  className={`transition-colors hover:text-foreground ${
                    isLast
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {segment}
                </button>
              </span>
            );
          })}
        </>
      )}
    </nav>
  );
}
