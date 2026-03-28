import { useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/layout";
import DataPoolTab from "@/components/DataPoolTab";
import { useProject } from "@/hooks/use-projects";

export default function DataPoolPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = searchParams.get("folder") ?? "";
  const projectId = Number(id);

  const { data: project, isLoading } = useProject(projectId);

  const handlePathChange = useCallback(
    (path: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (path) {
          next.set("folder", path);
        } else {
          next.delete("folder");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <PageBreadcrumb
            items={[
              {
                label: isLoading ? "..." : (project?.name ?? "프로젝트"),
                href: `/projects/${id}`,
              },
              { label: "데이터풀" },
            ]}
          />
          {isLoading && <Skeleton className="h-5 w-48" />}
        </div>
      </header>

      <main className="px-6 py-4 flex-1 flex flex-col overflow-hidden min-h-0">
        <DataPoolTab
          projectId={projectId}
          currentPath={currentPath}
          onPathChange={handlePathChange}
        />
      </main>
    </div>
  );
}
