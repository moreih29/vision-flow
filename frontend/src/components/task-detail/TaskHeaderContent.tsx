import { PageBreadcrumb } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/use-projects";
import type { Task } from "@/types/task";

interface TaskHeaderContentProps {
  task: Task | null;
  loading: boolean;
  projectId: number;
}

/**
 * DetailLayout의 header slot에 주입되는 상단 breadcrumb 영역.
 * 프로젝트 > 태스크 경로를 표시하며, 로딩 중이면 skeleton으로 대체한다.
 */
export function TaskHeaderContent({
  task,
  loading,
  projectId,
}: TaskHeaderContentProps) {
  const { data: project, isLoading: projectLoading } = useProject(projectId);

  if (loading) {
    return (
      <div className="flex items-center gap-4 select-none">
        <Skeleton className="h-5 w-48" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 select-none">
      <PageBreadcrumb
        items={[
          {
            label: projectLoading ? "..." : (project?.name ?? "프로젝트"),
            href: `/projects/${projectId}`,
          },
          { label: task?.name ?? "" },
        ]}
      />
    </div>
  );
}
