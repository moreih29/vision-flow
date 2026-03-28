import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function PageBreadcrumb({ items, className }: PageBreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn("flex items-center gap-1 text-sm", className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {isLast || (!item.href && !item.onClick) ? (
              <span
                className={cn(
                  isLast
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <Link
                to={item.href!}
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
