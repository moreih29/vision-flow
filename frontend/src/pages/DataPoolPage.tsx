import { useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb, DetailLayout } from "@/components/layout";
import DataPoolTab from "@/components/DataPoolTab";
import { useProject } from "@/hooks/use-projects";

export default function DataPoolPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = searchParams.get("folder") ?? "";
  const projectId = Number(id);
  const validProjectId = !isNaN(projectId) && projectId > 0;

  const { data: project, isLoading } = useProject(
    validProjectId ? projectId : 0,
  );

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

  const headerSlot = (
    <div className="flex items-center gap-4">
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
  );

  return (
    <DetailLayout header={headerSlot}>
      {validProjectId && (
        <DataPoolTab
          projectId={projectId}
          currentPath={currentPath}
          onPathChange={handlePathChange}
        />
      )}
    </DetailLayout>
  );
}
