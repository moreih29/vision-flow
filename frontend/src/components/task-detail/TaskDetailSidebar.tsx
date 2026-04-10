import { Database, ListTodo } from "lucide-react";
import {
  FileTreeView as FolderTreeView,
  type FileTreeRef as FolderTreeRef,
} from "@/components/file-tree";
import type { ComponentProps } from "react";
import type { DataStore } from "@/types/data-store";
import type { Task } from "@/types/task";

type FolderTreeViewProps = ComponentProps<typeof FolderTreeView>;

interface TaskDetailSidebarProps {
  task: Task | null;
  dataStore: DataStore | null;
  poolPanelOpen: boolean;
  effectiveViewerMode: "task" | "pool";
  currentPath: string;
  poolCurrentPath: string;
  // refs
  treeRef: React.RefObject<FolderTreeRef | null>;
  poolTreeRef: React.RefObject<FolderTreeRef | null>;
  // fetchers (FolderTreeView의 props 타입을 그대로 사용)
  fetchTaskFolderContents: FolderTreeViewProps["fetchFolderContents"];
  fetchTaskAllFolders: FolderTreeViewProps["fetchAllFolders"];
  fetchPoolFolderContents: FolderTreeViewProps["fetchFolderContents"];
  fetchPoolAllFolders: FolderTreeViewProps["fetchAllFolders"];
  // refresh
  refreshAll: () => void | Promise<void>;
  refreshPoolTree: () => void | Promise<void>;
  // navigation
  onViewerModeChange: (mode: "task" | "pool") => void;
  onTaskNavigateFolder: (path: string) => void;
  onPoolNavigateFolder: (path: string) => void;
  onTaskFileClick: NonNullable<FolderTreeViewProps["onFileClick"]>;
  onPoolFileClick: NonNullable<FolderTreeViewProps["onFileClick"]>;
  // task tree operations
  onDeleteFolder: NonNullable<FolderTreeViewProps["onDeleteFolder"]>;
  onUpdateFolder: NonNullable<FolderTreeViewProps["onUpdateFolder"]>;
  onCreateFolder: NonNullable<FolderTreeViewProps["onCreateFolder"]>;
  onItemDrop: NonNullable<FolderTreeViewProps["onItemDrop"]>;
}

/**
 * DetailLayout의 sidebar slot에 주입되는 좌측 영역.
 * Pool 트리(조건부) + Task 트리 조합.
 *
 * 상태/핸들러는 부모(TaskDetailPage)가 소유하고 props로 전달한다.
 * 이번 plan에서는 presentational 분리만 수행 — state/handler 이동은 별도 plan.
 */
export function TaskDetailSidebar({
  task,
  dataStore,
  poolPanelOpen,
  effectiveViewerMode,
  currentPath,
  poolCurrentPath,
  treeRef,
  poolTreeRef,
  fetchTaskFolderContents,
  fetchTaskAllFolders,
  fetchPoolFolderContents,
  fetchPoolAllFolders,
  refreshAll,
  refreshPoolTree,
  onViewerModeChange,
  onTaskNavigateFolder,
  onPoolNavigateFolder,
  onTaskFileClick,
  onPoolFileClick,
  onDeleteFolder,
  onUpdateFolder,
  onCreateFolder,
  onItemDrop,
}: TaskDetailSidebarProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 min-h-0">
      {/* Pool 섹션 — poolPanelOpen일 때만 렌더링 */}
      {poolPanelOpen && (
        <div
          className={`flex-1 rounded-lg border flex flex-col min-h-0 ${
            effectiveViewerMode === "pool"
              ? "border-mode-pool ring-1 ring-mode-pool"
              : "border-muted opacity-50"
          }`}
        >
          {!dataStore ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Data Pool이 없습니다.
            </p>
          ) : (
            <FolderTreeView
              ref={poolTreeRef}
              readOnly
              fetchFolderContents={fetchPoolFolderContents}
              fetchAllFolders={fetchPoolAllFolders}
              rootLabel="Data Pool"
              rootIcon={
                <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
              }
              rootCount={dataStore.image_count ?? 0}
              onRefresh={refreshPoolTree}
              selectedPath={
                effectiveViewerMode === "pool" ? poolCurrentPath : undefined
              }
              onSelectPath={(path) => {
                onViewerModeChange("pool");
                onPoolNavigateFolder(path);
              }}
              onFileClick={onPoolFileClick}
            />
          )}
        </div>
      )}

      {/* Task 섹션 */}
      <div
        className={`rounded-lg border p-2 flex flex-col overflow-hidden min-h-0 flex-1 ${
          !poolPanelOpen
            ? "border"
            : effectiveViewerMode === "task"
              ? "border-mode-task ring-1 ring-mode-task"
              : "border-muted opacity-50"
        }`}
      >
        <FolderTreeView
          ref={treeRef}
          fetchFolderContents={fetchTaskFolderContents}
          fetchAllFolders={fetchTaskAllFolders}
          rootLabel={task?.name ?? "Task"}
          rootCount={task?.image_count ?? 0}
          rootIcon={
            <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
          }
          selectedPath={currentPath}
          acceptDropTypes={[
            "application/x-task-items",
            "application/x-datapool-items",
          ]}
          onSelectPath={(path) => {
            onViewerModeChange("task");
            onTaskNavigateFolder(path);
          }}
          onFileClick={onTaskFileClick}
          onDeleteFolder={onDeleteFolder}
          onUpdateFolder={onUpdateFolder}
          onCreateFolder={onCreateFolder}
          onItemDrop={onItemDrop}
          onRefresh={refreshAll}
        />
      </div>
    </div>
  );
}
